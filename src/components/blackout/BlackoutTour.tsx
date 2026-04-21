import Joyride, { type CallBackProps, STATUS, type Step } from "react-joyride";

const STEPS: Step[] = [
  { target: "[data-tour='fleet']", content: "Primary fleet cards — battery, trust, and role at a glance.", disableBeacon: true },
  { target: "[data-tour='map3d']", content: "3D world map with trails, victim pulses, relay glow, and scenario overlays.", placement: "top" },
  { target: "[data-tour='charts']", content: "Streaming metrics downsampled to 10 Hz with a sliding window.", placement: "top" },
  { target: "[data-tour='timeline']", content: "Mission phase Gantt with export — click blocks to scrub a local cursor.", placement: "top" },
  { target: "[data-tour='hardware']", content: "ROS2 / PX4 bridge health, queue, and E-STOP path.", placement: "left" },
  { target: "[data-tour='vision']", content: "YOLO fusion — demo synthetic feed or live webcam, ONNX when models are bundled.", placement: "left" },
];

const STORAGE_KEY = "blackout-tour-done-v1";

export function BlackoutTour({ run, onClose }: { run: boolean; onClose: () => void }) {
  const handle = (data: CallBackProps) => {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(data.status)) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      onClose();
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      styles={{ options: { zIndex: 20000, primaryColor: "#22d3ee" } }}
      callback={handle}
    />
  );
}

export function shouldAutoStartBlackoutTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}
