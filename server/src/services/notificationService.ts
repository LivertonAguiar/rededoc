import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { listExpirations, ExpirationItem } from './expirationService.js';

export interface NotificationSetting {
  id: string;
  channel: string;
  target_url: string | null;
  advance_days: string; // Ex: '30,7,0'
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  status: string;
  sent_at: string;
  message: string;
  created_at: string;
}

/**
 * Envia um teste de Webhook para a URL configurada
 */
export async function testWebhook(targetUrl: string): Promise<{ success: boolean; message: string; statusCode?: number }> {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    throw new Error('A URL de destino do webhook deve ser válida e iniciar com http:// ou https://');
  }

  const payload = {
    event: 'test_notification',
    timestamp: new Date().toISOString(),
    system: 'ITFY Pro',
    message: 'Esta é uma notificação de teste disparada pelo sistema ITFY para validação de canal de alertas.'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ITFY-Alert-Bot/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    // Registra no log de auditoria
    const logId = 'nlg_' + crypto.randomUUID().slice(0, 8);
    const status = response.ok ? 'success' : 'failed';
    execute(`
      INSERT INTO notification_log (id, entity_type, entity_id, channel, status, sent_at, message)
      VALUES (?, 'system', 'test', 'webhook', ?, CURRENT_DATE, ?)
    `, logId, status, `Teste de webhook: HTTP ${response.status}`);

    if (!response.ok) {
      return {
        success: false,
        message: `Servidor remoto respondeu com status HTTP ${response.status}`,
        statusCode: response.status
      };
    }

    return {
      success: true,
      message: 'Notificação de teste enviada e aceita pelo servidor de destino!',
      statusCode: response.status
    };
  } catch (err: any) {
    const logId = 'nlg_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO notification_log (id, entity_type, entity_id, channel, status, sent_at, message)
      VALUES (?, 'system', 'test', 'webhook', 'failed', CURRENT_DATE, ?)
    `, logId, `Falha de conexão no teste: ${err.message}`);

    throw new Error(`Falha ao conectar com a URL do Webhook: ${err.message}`);
  }
}

/**
 * Verifica vencimentos e envia alertas para os canais ativos evitando duplicidade no mesmo dia
 */
export async function checkAndDispatchAlerts(): Promise<{ totalDispatched: number; skippedDuplicates: number; errors: number }> {
  const settings = queryAll<NotificationSetting>('SELECT * FROM notification_settings WHERE is_active = 1');
  if (settings.length === 0) {
    return { totalDispatched: 0, skippedDuplicates: 0, errors: 0 };
  }

  // Lista todos os vencimentos até 30 dias (incluindo já vencidos)
  const items = listExpirations({ withinDays: 30 });
  if (items.length === 0) {
    return { totalDispatched: 0, skippedDuplicates: 0, errors: 0 };
  }

  let totalDispatched = 0;
  let skippedDuplicates = 0;
  let errors = 0;

  for (const setting of settings) {
    if (!setting.target_url || !setting.target_url.startsWith('http')) {
      continue;
    }

    // Dias de antecedência configurados para este canal
    const allowedDays = setting.advance_days.split(',').map(d => Number(d.trim())).filter(n => !isNaN(n));

    for (const item of items) {
      // Verifica se o item deve ser notificado hoje (vencido ou coincidindo com os marcos de antecedência)
      const shouldNotify = item.daysRemaining <= 0 || allowedDays.some(d => item.daysRemaining <= d);
      if (!shouldNotify) continue;

      // Desduplicação: o mesmo alerta NÃO é enviado duas vezes no mesmo dia
      const alreadySentToday = queryOne<any>(`
        SELECT id FROM notification_log
        WHERE entity_type = ? AND entity_id = ? AND channel = ? AND sent_at = CURRENT_DATE
      `, item.entityType, item.entityId, setting.channel);

      if (alreadySentToday) {
        skippedDuplicates++;
        continue;
      }

      const urgencyLabel = item.daysRemaining < 0
        ? `⚠️ VENCIDO há ${Math.abs(item.daysRemaining)} dias`
        : item.daysRemaining === 0
        ? '🚨 VENCE HOJE!'
        : `⏳ Vence em ${item.daysRemaining} dias`;

      const alertPayload = {
        event: 'item_expiration_alert',
        system: 'ITFY Pro',
        timestamp: new Date().toISOString(),
        item: {
          id: item.id,
          kind: item.kind,
          entityType: item.entityType,
          entityId: item.entityId,
          title: item.title,
          subtitle: item.subtitle,
          client: item.clientName,
          dueDate: item.dueAt,
          daysRemaining: item.daysRemaining,
          status: item.status,
          urgency: urgencyLabel
        },
        message: `[ALERTA ITFY] ${urgencyLabel}: "${item.title}" (${item.subtitle}) do cliente "${item.clientName}". Data: ${item.dueAt}.`
      };

      try {
        const res = await fetch(setting.target_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ITFY-Alert-Bot/1.0'
          },
          body: JSON.stringify(alertPayload)
        });

        const logId = 'nlg_' + crypto.randomUUID().slice(0, 8);
        const status = res.ok ? 'success' : 'failed';
        execute(`
          INSERT INTO notification_log (id, entity_type, entity_id, channel, status, sent_at, message)
          VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?)
        `, logId, item.entityType, item.entityId, setting.channel, status, alertPayload.message);

        if (res.ok) {
          totalDispatched++;
        } else {
          errors++;
        }
      } catch (err: any) {
        errors++;
        const logId = 'nlg_' + crypto.randomUUID().slice(0, 8);
        execute(`
          INSERT INTO notification_log (id, entity_type, entity_id, channel, status, sent_at, message)
          VALUES (?, ?, ?, ?, 'failed', CURRENT_DATE, ?)
        `, logId, item.entityType, item.entityId, setting.channel, `Erro ao despachar: ${err.message}`);
      }
    }
  }

  return { totalDispatched, skippedDuplicates, errors };
}

/**
 * Inicializa o agendador em segundo plano dentro do processo Node
 * Executa uma verificação a cada hora e dispara por volta das 08:00 (configurável por ALERT_HOUR / TZ)
 */
let schedulerInterval: NodeJS.Timeout | null = null;
let lastDispatchDate = '';

export function startNotificationScheduler() {
  if (schedulerInterval) return;

  const targetHour = parseInt(process.env.ALERT_HOUR || '8', 10);
  const timeZone = process.env.TZ || 'America/Fortaleza';

  console.log(`[ALERTA] Agendador de notificações ativado. Horário alvo: ~${targetHour}:00 (${timeZone}).`);

  // Executa checagem periódica a cada hora
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Formata a hora no fuso configurado
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false
      });
      const currentHour = parseInt(formatter.format(now), 10);
      const currentDate = now.toISOString().slice(0, 10);

      // Se for a hora alvo e ainda não rodou hoje
      if (currentHour === targetHour && lastDispatchDate !== currentDate) {
        console.log(`[ALERTA] Disparando rotina diária de verificação de vencimentos...`);
        lastDispatchDate = currentDate;
        const result = await checkAndDispatchAlerts();
        console.log(`[ALERTA] Concluído: ${result.totalDispatched} enviados, ${result.skippedDuplicates} desduplicados, ${result.errors} erros.`);
      }
    } catch (err) {
      console.error('[ALERTA] Erro no agendador de notificações:', err);
    }
  }, 60 * 60 * 1000); // 1 hora
}
