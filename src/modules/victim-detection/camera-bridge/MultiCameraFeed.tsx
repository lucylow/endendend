import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CameraTile } from "./CameraTile";
import type { CameraFeedState } from "../types";

export function MultiCameraFeed({
  feeds,
  frameTick,
  canvasesRef,
  videoRef,
  onAttachWebRtc,
  showThermal,
}: {
  feeds: CameraFeedState[];
  frameTick: number;
  canvasesRef: React.MutableRefObject<HTMLCanvasElement[]>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onAttachWebRtc: () => void;
  showThermal: boolean;
}) {
  const stream = feeds[3]?.stream ?? null;
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, videoRef]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Multi-camera fusion — PX4 / ROS2 simulated tiles; optional live WebRTC on slot 4.
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={onAttachWebRtc}>
          Attach WebRTC camera
        </Button>
      </div>
      <video ref={videoRef} className="pointer-events-none fixed -left-[9999px] h-1 w-1 opacity-0" autoPlay playsInline muted />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {feeds.map((feed, i) => (
          <CameraTile
            key={feed.id}
            index={i}
            feed={feed}
            videoRef={i === 3 ? videoRef : null}
            simCanvas={canvasesRef.current[i] ?? null}
            showThermal={showThermal}
            frameTick={frameTick}
          />
        ))}
      </div>
    </div>
  );
}
