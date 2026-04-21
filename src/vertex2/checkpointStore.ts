export class MeshCheckpointStore {
  private ids: string[] = [];

  save(id: string): void {
    this.ids.push(id);
    this.ids = this.ids.slice(-24);
  }

  list(): string[] {
    return [...this.ids];
  }
}
