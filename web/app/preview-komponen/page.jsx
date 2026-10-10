// /preview-komponen — internal page buat ngecek design system.
// Hapus page ini setelah desain final disetujui.

import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { tokens, generateTicketId, statusLabel, classLabel } from '@/lib/design-system';

export default function PreviewKomponen() {
  const sampleTicket = generateTicketId();
  return (
    <main className="min-h-screen ds-bg p-6 sm:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold ds-text">Design System Preview</h1>
          <p className="ds-text-muted mt-1">Internal page untuk review komponen library.</p>
        </div>
        <ThemeToggle />
      </div>

      {/* Buttons */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold ds-text mb-4">Button</h2>
        <Card padding="md">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="outline">Outline</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center mt-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large (mobile-friendly)</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4">
            <Button variant="primary" fullWidth>Full-width primary (mobile CTA)</Button>
          </div>
        </Card>
      </section>

      {/* Cards */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold ds-text mb-4">Card</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Default</CardTitle>
              <CardDescription>Standard surface dengan border tipis</CardDescription>
            </CardHeader>
            <p className="ds-text-muted text-sm">Isi card apa aja di sini.</p>
          </Card>
          <Card variant="muted">
            <CardHeader>
              <CardTitle>Muted</CardTitle>
              <CardDescription>Background muted, tanpa border</CardDescription>
            </CardHeader>
            <p className="ds-text-muted text-sm">Untuk section separator.</p>
          </Card>
          <Card variant="outline" shadow="none">
            <CardHeader>
              <CardTitle>Outline</CardTitle>
              <CardDescription>Border tebal, tanpa shadow</CardDescription>
            </CardHeader>
            <p className="ds-text-muted text-sm">Untuk highlight.</p>
          </Card>
        </div>
      </section>

      {/* Badges */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold ds-text mb-4">Badge</h2>
        <Card padding="md">
          <div className="flex flex-wrap gap-2 mb-3">
            <StatusBadge status="PENDING" />
            <StatusBadge status="IN_PROGRESS" />
            <StatusBadge status="DONE" />
            <StatusBadge status="ERROR" />
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <SeverityBadge severity="LOW" />
            <SeverityBadge severity="MEDIUM" />
            <SeverityBadge severity="HIGH" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="brand">Brand</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="severity-low" size="sm">Small</Badge>
          </div>
        </Card>
      </section>

      {/* Sample data preview */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold ds-text mb-4">Sample data helpers</h2>
        <Card padding="md">
          <div className="space-y-2 text-sm">
            <div><span className="ds-text-muted">Ticket ID:</span> <code className="ds-font-mono font-medium">{sampleTicket}</code></div>
            <div><span className="ds-text-muted">Sample class:</span> <code>{classLabel.jalan_bolong}</code></div>
            <div><span className="ds-text-muted">Status:</span> {statusLabel.IN_PROGRESS}</div>
          </div>
        </Card>
      </section>

      {/* Token dump */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold ds-text mb-4">Color palette</h2>
        <div className="grid grid-cols-5 sm:grid-cols-11 gap-2">
          {Object.entries(tokens.color.brand).map(([k, v]) => (
            <div key={k} className="text-center">
              <div className="h-12 w-full rounded" style={{ background: v }} />
              <div className="text-xs mt-1 ds-text-muted">{k}</div>
              <div className="text-[10px] ds-text-subtle ds-font-mono">{v}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}