import { Switch } from "@/components/ui/switch";

interface ModeToggleProps {
  isMarketMode: boolean;
  onToggle: (isMarketMode: boolean) => void;
}

export default function ModeToggle({ isMarketMode, onToggle }: ModeToggleProps) {
  return (
    <div className="flex items-center space-x-3 md3-surface-container-high px-3 py-2 rounded-full">
      <span className={`md3-label-medium transition-all duration-200 ${!isMarketMode ? 'opacity-100' : 'opacity-60'}`}>
        Casa
      </span>
      <Switch
        checked={isMarketMode}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-[color:var(--secondary)]"
      />
      <span className={`md3-label-medium transition-all duration-200 ${isMarketMode ? 'opacity-100' : 'opacity-60'}`}>
        Market
      </span>
    </div>
  );
}
