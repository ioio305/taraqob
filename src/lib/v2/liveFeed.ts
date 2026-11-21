// ================================================================
// مصدر الأسعار المباشرة بواجهة Tradier: إمّا Tradier نفسه، أو جسر Interactive Brokers
// (ibkr-bridge/) الذي يحاكي نقاط Tradier المستخدمة في ترقّب حرفياً — فتبقى كل فحوص
// الحداثة وبوابات الدخول المعايرة كما هي دون تعديل.
//
// الجسر له الأولوية متى ضُبط:  IBKR_BRIDGE_URL + IBKR_BRIDGE_TOKEN
// وإلا Tradier:               TRADIER_API_KEY (+ TRADIER_BASE_URL اختياري)
// ================================================================

const TRADIER_DEFAULT = 'https://api.tradier.com/v1'

export function liveFeedName(): 'ibkr' | 'tradier' {
  return process.env.IBKR_BRIDGE_URL && process.env.IBKR_BRIDGE_TOKEN ? 'ibkr' : 'tradier'
}

export function liveFeedBase(): string {
  if (liveFeedName() === 'ibkr') return `${process.env.IBKR_BRIDGE_URL!.replace(/\/+$/, '')}/v1`
  return (process.env.TRADIER_BASE_URL || TRADIER_DEFAULT).replace(/\/+$/, '')
}

export function liveFeedToken(): string | undefined {
  return liveFeedName() === 'ibkr' ? process.env.IBKR_BRIDGE_TOKEN : process.env.TRADIER_API_KEY
}
