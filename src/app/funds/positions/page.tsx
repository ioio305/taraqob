import TradeJournal from '@/components/v2/TradeJournal'

// متابعة صفقاتي — أداة شخصية موحّدة عبر المنصّات (دفترك العام).
export default function FundsPositionsPage() {
  return <TradeJournal view="positions" platform="funds" />
}
