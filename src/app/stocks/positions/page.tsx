import TradeJournal from '@/components/v2/TradeJournal'

// متابعة صفقاتي — أداة شخصية موحّدة عبر المنصّات (دفترك العام).
export default function StocksPositionsPage() {
  return <TradeJournal view="positions" platform="stocks" />
}
