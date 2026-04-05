export class HeatPropagationModel {
  getHeatingRate(distance: number): number {
    return Math.max(0, 0.8 / (distance * distance + 1)) * 2.5;
  }

  getCoolingRate(velocity: number): number {
    return 0.02 + velocity * 0.1 + 0.015;
  }

  getShieldingEffect(shieldDistance: number): number {
    return 0.6 / (shieldDistance * shieldDistance + 1);
  }
}
