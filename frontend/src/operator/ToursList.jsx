import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Segmented, Spinner } from '../components/ui'
import { ToursTable } from './Dashboard'
import { PageHead, useOps } from './OperatorApp'

export default function ToursList() {
  const { tick } = useOps()
  const [params, setParams] = useSearchParams()
  const [tours, setTours] = useState(null)
  const stage = params.get('stage') || 'all'
  useEffect(() => { api.tours().then(setTours) }, [tick])
  if (!tours) return <Spinner />
  const shown = tours.filter((t) => stage === 'all' || t.stage === stage)
  return (
    <div>
      <PageHead title="Tours" sub={`${tours.length} customised tours, every one different, all in one place`}>
        <div className="w-[34rem] max-w-full">
          <Segmented value={stage} onChange={(v) => setParams(v === 'all' ? {} : { stage: v })}
            options={[['all', 'All'], ['plan', 'Planning'], ['prepare', 'Preparing'], ['operate', 'On tour'], ['complete', 'Completed'], ['review', 'Reviewed']].map(([value, label]) => ({ value, label }))} />
        </div>
      </PageHead>
      <ToursTable tours={shown} />
    </div>
  )
}
