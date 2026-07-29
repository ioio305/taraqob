'use client'

import { createContext, useContext, type ReactNode } from 'react'

const StocksTierContext = createContext({ tier: 'radar', isStaff: false })

export function StocksTierProvider({
  children,
  tier,
  isStaff,
}: {
  children: ReactNode
  tier: string
  isStaff: boolean
}) {
  return (
    <StocksTierContext.Provider value={{ tier, isStaff }}>
      {children}
    </StocksTierContext.Provider>
  )
}

export function useStocksTier() {
  return useContext(StocksTierContext)
}
