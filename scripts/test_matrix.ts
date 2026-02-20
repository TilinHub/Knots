import { Matrix } from '../src/features/analysis/first_variation/linearAlgebra';

console.log('--- Testing Matrix ---');

const A = new Matrix(2, 3, [
  [1, 2, 3],
  [4, 5, 6],
]);

console.log('A:');
console.log(A.toString());

const B = new Matrix(3, 2, [
  [7, 8],
  [9, 1],
  [2, 3],
]);

console.log('B:');
console.log(B.toString());

const C = A.multiply(B);
console.log('C = A*B (Expected: [31 19] [85 55]):');
console.log(C.toString());

// Test Transpose
const At = A.transpose();
console.log('At:');
console.log(At.toString());

// Test Vector Dot
const v1 = Matrix.fromArray([1, 2, 3]);
const v2 = Matrix.fromArray([4, 5, 6]);
console.log('v1 dot v2 (Expected 32):');
console.log(v1.transpose().multiply(v2).toString());
