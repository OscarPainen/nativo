import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

/** Pantalla puente para rutas que se implementan en fases posteriores. */
export default function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted">Se implementa en {phase}.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="ghost">Volver al inicio</Button>
        </Link>
      </Card>
    </main>
  );
}
