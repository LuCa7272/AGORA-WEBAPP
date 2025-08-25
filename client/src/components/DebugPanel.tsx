import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DebugPanelProps {
  title: string;
  data: any;
  isLoading?: boolean;
}

// Stile per mantenere il pannello fisso e non invadente
const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '6rem', // Sopra la barra di navigazione
  right: '1rem',
  width: '350px',
  maxHeight: '40vh',
  overflowY: 'auto',
  zIndex: 9999,
  fontSize: '11px',
  lineHeight: '1.2',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(20, 20, 20, 0.9)',
  color: '#0f0',
  border: '1px solid #0f0',
  backdropFilter: 'blur(4px)',
};

const preStyle: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  margin: 0,
};

export function DebugPanel({ title, data, isLoading = false }: DebugPanelProps) {
  // Mostra il pannello solo in modalità sviluppo
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card style={panelStyle}>
      <CardHeader className="p-2 border-b border-green-700">
        <CardTitle className="text-sm text-green-400">
          [DEBUG] {title} {isLoading && '(Caricamento...)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <pre style={preStyle}>
          {JSON.stringify(data, null, 2) || 'Nessun dato'}
        </pre>
      </CardContent>
    </Card>
  );
}