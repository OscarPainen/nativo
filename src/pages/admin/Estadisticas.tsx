import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStats } from '@/hooks/useStats';
import { PERIOD_LABEL, type Period } from '@/services/stats.service';
import MetricCard from '@/components/admin/MetricCard';
import { formatCLP } from '@/utils/format';

const PERIODS: Period[] = ['week', 'month', 'lastMonth', 'last3'];
const PIE_COLORS = ['#ca8a04', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2'];

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Estadisticas() {
  const [period, setPeriod] = useState<Period>('month');
  const { stats, loading } = useStats(period);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estadísticas</h1>
        <select
          className="rounded border border-border bg-surface px-2 py-1.5 text-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      {loading || !stats ? (
        <p className="text-sm text-muted">Calculando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <MetricCard label="Reservas confirmadas" value={String(stats.totalConfirmed)} />
            <MetricCard label="Ingresos" value={formatCLP(stats.totalIncome)} />
            <MetricCard label="Tasa de aprobación" value={`${Math.round(stats.approvalRate)}%`} />
            <MetricCard label="Tasa de ocupación" value={`${Math.round(stats.occupancy)}%`} />
            <MetricCard
              label="Cliente más frecuente"
              value={stats.topClient?.name ?? '—'}
              hint={stats.topClient ? `${stats.topClient.count} cortes` : undefined}
            />
            <MetricCard
              label="Servicio más solicitado"
              value={stats.topService?.name ?? '—'}
              hint={stats.topService ? `${stats.topService.count} reservas` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Reservas por día de la semana">
              <BarChart data={stats.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="reservas" fill="#ca8a04" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Ingresos por semana">
              <BarChart data={stats.incomeByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="semana" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => formatCLP(v)} />
                <Bar dataKey="ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Distribución por servicio">
              <PieChart>
                <Pie data={stats.byService} dataKey="value" nameKey="name" outerRadius={90} label>
                  {stats.byService.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartCard>

            <ChartCard title="Evolución (últimas 8 semanas)">
              <LineChart data={stats.evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="semana" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="reservas" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ChartCard>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-medium">Resumen por servicio</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1">Servicio</th>
                  <th className="py-1">Cantidad</th>
                  <th className="py-1">Ingresos</th>
                  <th className="py-1">% del total</th>
                </tr>
              </thead>
              <tbody>
                {stats.serviceSummary.map((s) => (
                  <tr key={s.name} className="border-t border-border">
                    <td className="py-1.5">{s.name}</td>
                    <td className="py-1.5">{s.count}</td>
                    <td className="py-1.5">{formatCLP(s.income)}</td>
                    <td className="py-1.5">{Math.round(s.pct)}%</td>
                  </tr>
                ))}
                {stats.serviceSummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-muted">
                      Sin datos en el período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
