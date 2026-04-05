import type { VictimDetection } from "../types";
import { letterboxToTensor } from "./preprocess";
import { postprocessYOLOv8Output } from "./postprocess";
import { mockDetectionsFromFrame } from "./mockDetections";

export type YOLODetectorBackend = "onnx" | "mock";

export class ProductionYOLODetector {
  inputSize = 640;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;
  private inputName = "images";
  private backend: YOLODetectorBackend = "mock";
  private frameCounter = 0;

  get activeBackend(): YOLODetectorBackend {
    return this.backend;
  }

  async init(modelUrl: string): Promise<void> {
    try {
      const ortMod = await import("onnxruntime-web");
      const wasm = ortMod.default ?? ortMod;
      wasm.env.wasm.numThreads = 1;
      wasm.env.wasm.simd = true;

      const session = await wasm.InferenceSession.create(modelUrl, {
        executionProviders: ["wasm"],
      });
      const in0 = session.inputNames[0];
      if (in0) this.inputName = in0;
      this.session = session;
      this.backend = "onnx";
    } catch {
      this.session = null;
      this.backend = "mock";
    }
  }

  dispose(): void {
    this.session = null;
    this.backend = "mock";
  }

  async detect(frame: ImageData, confThreshold = 0.7): Promise<VictimDetection[]> {
    this.frameCounter += 1;
    if (!this.session) {
      return mockDetectionsFromFrame(this.frameCounter + frame.width * 7, frame.width, frame.height);
    }

    const { tensorData, scale, padX, padY } = letterboxToTensor(frame, this.inputSize);
    const ortMod = await import("onnxruntime-web");
    const wasm = ortMod.default ?? ortMod;
    const inputTensor = new wasm.Tensor("float32", tensorData, [1, 3, this.inputSize, this.inputSize]);
    const feeds: Record<string, unknown> = { [this.inputName]: inputTensor };
    const results = await this.session.run(feeds);
    const outName = this.session.outputNames[0] as string;
    const output = results[outName] as { dims: readonly number[]; data: Float32Array } | undefined;
    if (!output?.data || !output.dims) {
      return mockDetectionsFromFrame(this.frameCounter, frame.width, frame.height);
    }

    return postprocessYOLOv8Output(
      output,
      confThreshold,
      frame.width,
      frame.height,
      scale,
      padX,
      padY,
      true,
    );
  }
}
