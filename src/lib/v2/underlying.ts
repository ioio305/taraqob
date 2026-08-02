// ── استخراج المؤشر/السهم الأم من رمز العقد الرسمي ────────────────────────────
// رمز العقد الرسمي يبدأ بحروف الجذر ثم 6 أرقام للتاريخ: QQQ260810C00688000
// جذر سباكس له صيغتان: SPX وSPXW — كلاهما SPX.

export function underlyingFromContract(contractSymbol: string | null | undefined): string {
  const m = (contractSymbol ?? '').match(/^([A-Z]+)\d{6}[CP]\d{8}$/)
  const root = m?.[1] ?? ''
  if (root === 'SPX' || root === 'SPXW') return 'SPX'
  return root || 'SPX'
}
