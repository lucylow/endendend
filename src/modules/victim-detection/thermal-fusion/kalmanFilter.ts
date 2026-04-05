/** Simple 1D Kalman for smoothing fused scores over time. */
export class KalmanFilter1D {
  private x = 0;
  private p = 1;
  readonly q: number;
  readonly r: number;

  constructor(processNoise = 0.02, measurementNoise = 0.15) {
    this.q = processNoise;
    this.r = measurementNoise;
  }

  update(measurement: number): number {
    this.p = this.p + this.q;
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;
    return this.x;
  }

  reset(initial = 0): void {
    this.x = initial;
    this.p = 1;
  }
}
