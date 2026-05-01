import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  // Get the contract to find its session
  const { data: contract } = await supabase
    .from('option_contracts')
    .select('session_id, contract_quality')
    .eq('id', params.id)
    .single()

  if (!contract) return NextResponse.json({ error: 'العقد غير موجود' }, { status: 404 })

  if (contract.contract_quality === 'avoid') {
    return NextResponse.json({ error: 'لا يمكن اختيار عقد ذو جودة "تجنب"' }, { status: 400 })
  }

  // Deselect all contracts in this session
  await supabase
    .from('option_contracts')
    .update({ is_selected: false })
    .eq('session_id', contract.session_id)

  // Select this contract
  const { data, error } = await supabase
    .from('option_contracts')
    .update({ is_selected: true })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
