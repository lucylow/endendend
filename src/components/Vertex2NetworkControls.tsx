import { Button } from "@/components/ui/button";

type Props = {
  onInjectLoss: () => void;
  onInjectLatency: () => void;
  onPartitionOn: () => void;
  onPartitionOff: () => void;
  onResetStress: () => void;
};

export function Vertex2NetworkControls({ onInjectLoss, onInjectLatency, onPartitionOn, onPartitionOff, onResetStress }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onInjectLoss}>
        +Loss
      </Button>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onInjectLatency}>
        +Latency
      </Button>
      <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={onPartitionOn}>
        Partition
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onPartitionOff}>
        Heal
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onResetStress}>
        Reset stress
      </Button>
    </div>
  );
}
