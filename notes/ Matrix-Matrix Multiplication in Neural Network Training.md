Training deep neural networks involves repeated matrix-matrix multiplications.  
你训练一个神经网络时，90%时间都花在 GEMM（矩阵乘）上。  
(GEneral Matrix Multiplication, 完整定义是 C = αAB + βC，不是常规的 C=AB)  
我们先理解一个最简单的网络

**假设：**

- 输入图片是 784 维（28×28 MNIST）
- 第一层 256 个神经元
- 第二层 128 个神经元
- 输出层 10 类

那第一层的计算是：

```python
Z1 = X · W1 + b1
```

| 符号 | 维度               |
|------|--------------------|
| X    | (batch_size × 784) |
| W1   | (784 × 256)        |（每个neural都要看全部 784 个输入做加权求和 * 一共有 256 个神经元）|
| Z1   | (batch_size × 256) |

这是标准的矩阵乘 - GEMM。

---

## Major operations

### ▶ Forward pass: Compute activations.

Forward 就是：

```python
Z1 = XW1
A1 = activation(Z1)

Z2 = A1W2
A2 = activation(Z2)

Z3 = A2W3
Output = softmax(Z3)
```

每一层：上一层输出 × 权重矩阵  
所以每一层 = 一个 GEMM。

如果有 3 层：

forward 就有 3 次矩阵乘。

### ▶ Backward pass: Compute gradients.

**1️⃣ 权重梯度**  
反向传播本质是求梯度。

梯度公式（核心两条）：

```python
dW = A^T · dZ
```

```text
(batch × hidden)^T × (batch × next)
= (hidden × batch) × (batch × next)
= (hidden × next)
```
又是矩阵乘。

**2️⃣ 误差传播**

```python
dZ_prev = dZ · W^T
```
又是矩阵乘。

---

所以 Forward 每层 1 次 GEMM  
Backward 每层 2 次 GEMM

如果你有 L 层：  
每个 epoch = 3L 次 GEMM  
再乘上 batch 数量。

这就是为什么：

80%–95% 时间都花在 GEMM 上

### ▶ Weight update: Apply gradient descent.

---

## 修改成 matrix-matrix formulation

原来最基础的写法：

```python
for sample:
    for neuron:
        for input:
            ...
```

这是“逐样本计算”。

但 HPC 改成：

一次处理整个 batch：

```text
X(batch × input) × W(input × output)
```

变成真正的 GEMM。

---

**BLAS = Basic Linear Algebra Subprograms**  
`cblas_sgemm(...)`  
这个函数是高度优化的矩阵乘。

内部做了：

- tiling（分块）
- cache blocking
- loop unrolling
- SIMD
- OpenMP
- CPU 指令集优化

手写三重循环不可能比它快。

---

## 总结

- Forward pass: Compute activations.  
  `Z = A_prev × W`
- Backward pass: Compute gradients.  
  `dW = A_prev^T × dZ`
- Weight update: Apply gradient descent.  
  `dZ_prev = dZ × W^T`

整个神经网络 = 这些公式重复。

> notes:  
> 神经网络训练时，我们不是一次处理一个样本，而是一次处理一整个 batch。  
> 假设：  
> - batch = 256  
> - input = 784  
> - hidden = 128  
>
> 那么：  
> 输入矩阵 X  
> X 的维度 = (batch × input)  
> = (256 × 784)  
> 权重矩阵 W  
> W 的维度 = (input × hidden)  
> = (784 × 128)  
> 结果 Z  
>
> 矩阵乘规则：  
> (256 × 784) × (784 × 128)  
> 中间 784 消掉  
>
> 得到：  
> Z = (256 × 128)  
> 也就是 (batch × hidden)

**Tensor Core 做的不是普通乘法**

它做的是：  
`D = A × B + C`  
不是只算 `A × B`。  
而是乘完直接加上 C（Fused operation）。

如果分开算：  
1. 先算 `A × B`  
2. 再加 `C`  

需要：

- 多一次读写显存
- 多一次寄存器存储

Tensor Core 把它合成：一次硬件操作完成，减少数据搬运。

Conclusion   
▶Matrix-matrix multiplications (GEMMs) dominate deep
learning computation.  
▶Tensor Cores provide highly efficient mixed-precision matrix
operations.   
▶Using Tensor Cores with optimized libraries results in faster
training and inference.  
▶Efficient implementations (e.g., cuBLAS, Tensor Cores) are
crucial for high-performance training.  
