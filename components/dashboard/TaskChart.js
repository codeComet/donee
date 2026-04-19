'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
        {label ? format(parseISO(String(label)), 'MMM d, yyyy') : ''}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-slate-600 dark:text-slate-300 capitalize">{p.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function TaskChart({ data }) {
  if (!data?.length) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Tasks — Last 14 Days</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => (d ? format(parseISO(d), 'MMM d') : '')}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 12 }}
            formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
          <Bar dataKey="created" name="created" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="completed" name="completed" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
