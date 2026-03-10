/**
 * Zero-dependency generic Min-Heap priority queue.
 * Optimized for Dijkstra and A* pathfinding algorithms.
 */
export class MinHeap<T> {
    private heap: { priority: number; value: T }[] = [];

    push(value: T, priority: number): void {
        this.heap.push({ priority, value });
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        if (this.heap.length === 1) return this.heap.pop()?.value;

        const min = this.heap[0].value;
        this.heap[0] = this.heap.pop()!;
        this.sinkDown(0);
        return min;
    }

    get size(): number {
        return this.heap.length;
    }

    private bubbleUp(i: number): void {
        while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (this.heap[p].priority <= this.heap[i].priority) break;
            const tmp = this.heap[p];
            this.heap[p] = this.heap[i];
            this.heap[i] = tmp;
            i = p;
        }
    }

    private sinkDown(i: number): void {
        const len = this.heap.length;
        while (true) {
            let left = 2 * i + 1;
            let right = 2 * i + 2;
            let smallest = i;

            if (left < len && this.heap[left].priority < this.heap[smallest].priority) {
                smallest = left;
            }
            if (right < len && this.heap[right].priority < this.heap[smallest].priority) {
                smallest = right;
            }
            if (smallest === i) break;

            const tmp = this.heap[i];
            this.heap[i] = this.heap[smallest];
            this.heap[smallest] = tmp;
            i = smallest;
        }
    }
}
