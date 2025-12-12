# 演示模式实现指南

> 适用于需要录制演示视频的 FHEVM 或其他依赖外部服务的 DApp 项目

---

## 🎯 功能说明

在演示录制时，外部服务（如 Relayer）可能宕机或响应慢，导致演示失败。演示模式可以：

1. **尝试真实流程**：优先使用真实的链上交易和解密
2. **自动兜底**：超时后自动切换到前端 Mock，保证演示成功
3. **对观众透明**：UI 完全一致，观众无法分辨是真实还是 Mock

---

## 📋 核心逻辑

```
1. 用户提交 → 真实链上交易（保留 tx hash）
2. 保存明文数据到 localStorage
3. 尝试真实解密（5 秒超时）
   ├─ 成功 → 显示真实结果 ✅
   └─ 超时/失败 → 使用前端 Mock ✅
```

---

## 🔧 实现步骤

### Step 1: 添加演示模式检测函数

在页面顶部添加：

```typescript
// ==================== 演示模式检测 ====================
function checkDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  // 1. URL 参数（优先级最高）
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') return true;
  
  // 2. localStorage
  if (localStorage.getItem('DEMO_MODE') === 'true') return true;
  
  // 3. 环境变量（仅开发环境）
  if (process.env.NODE_ENV === 'development' && 
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;
  
  return false;
}
```

---

### Step 2: 在组件中检测模式

```typescript
export default function YourPage() {
  const [demoMode, setDemoMode] = useState(false);
  
  // 检测演示模式
  useEffect(() => {
    const isDemo = checkDemoMode();
    setDemoMode(isDemo);
    if (isDemo) {
      console.log('🎭 DEMO MODE ACTIVATED');
    } else {
      console.log('🔐 REAL MODE');
    }
  }, []);
  
  // ... 其他逻辑
}
```

---

### Step 3: 提交时保存明文数据

```typescript
const handleSubmit = async () => {
  // ... 加密和提交逻辑
  
  const tx = await contract.submit(encryptedData, proof);
  await tx.wait();
  
  // 演示模式：保存明文数据
  if (demoMode) {
    localStorage.setItem(`lastGuess_${userAddress}`, plaintextValue);
    console.log('🎭 Saved plaintext for demo mode');
  }
  
  // 立即允许解密（无倒计时）
  setCanDecrypt(true);
};
```

---

### Step 4: 解密时添加超时和 Mock 逻辑

```typescript
const handleDecrypt = async () => {
  setIsDecrypting(true);
  
  try {
    // 创建解密 Promise
    const decryptPromise = realayerSDK.userDecrypt(...);
    
    // 演示模式：5 秒超时
    if (demoMode) {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );
      
      try {
        // 竞速：真实解密 vs 超时
        const result = await Promise.race([decryptPromise, timeoutPromise]);
        
        // 真实解密成功
        console.log('✅ Real decryption succeeded');
        setResult(result);
        
      } catch (timeoutError: any) {
        if (timeoutError.message === 'TIMEOUT') {
          // 超时，使用 Mock
          console.log('⏰ Timeout, using mock...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟延迟
          
          const savedValue = localStorage.getItem(`lastGuess_${userAddress}`);
          const mockResult = calculateMockResult(savedValue); // 根据业务逻辑计算
          
          console.log('🎭 Mock result:', mockResult);
          setResult(mockResult);
          
          // 清除记录
          localStorage.removeItem(`lastGuess_${userAddress}`);
        } else {
          throw timeoutError;
        }
      }
    } else {
      // 真实模式：正常解密
      const result = await decryptPromise;
      console.log('✅ Real decryption:', result);
      setResult(result);
    }
    
  } catch (error: any) {
    // 演示模式下的其他错误也走 Mock
    if (demoMode && error.message?.includes('500')) {
      console.log('🎭 Error, using mock fallback...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const savedValue = localStorage.getItem(`lastGuess_${userAddress}`);
      const mockResult = calculateMockResult(savedValue);
      
      setResult(mockResult);
      localStorage.removeItem(`lastGuess_${userAddress}`);
    } else {
      // 真实模式显示错误
      setError(error.message);
    }
  } finally {
    setIsDecrypting(false);
  }
};
```

---

### Step 5: Landing Page 传递参数

```typescript
// app/page.tsx
import { useSearchParams } from 'next/navigation';

export default function HomePage() {
  const searchParams = useSearchParams();
  const demoParam = searchParams.get('demo');
  
  return (
    <Link href={demoParam ? `/dapp?demo=${demoParam}` : '/dapp'}>
      <button>开始使用</button>
    </Link>
  );
}
```

---

## 🎬 使用方法

### 开启演示模式

**方式 1：URL 参数（推荐录制时使用）**
```
访问: http://localhost:3000?demo=true
```

**方式 2：控制台命令**
```javascript
localStorage.setItem('DEMO_MODE', 'true')
location.reload()
```

**方式 3：环境变量**
```bash
# .env.local
NEXT_PUBLIC_DEMO_MODE=true
```

---

### 关闭演示模式

**方式 1：改 URL**
```
访问: http://localhost:3000
（不带 ?demo=true）
```

**方式 2：控制台命令**
```javascript
localStorage.removeItem('DEMO_MODE')
location.reload()
```

---

## ⚙️ 自定义配置

### 1. 调整超时时间

```typescript
// 从 5 秒改为 10 秒
const timeoutPromise = new Promise<never>((_, reject) => 
  setTimeout(() => reject(new Error('TIMEOUT')), 10000)
);
```

---

### 2. 自定义 Mock 逻辑

```typescript
// 示例：猜数字游戏
function calculateMockResult(savedValue: string | null): number {
  const SECRET_NUMBER = 888;
  return savedValue === String(SECRET_NUMBER) ? 1 : 0;
}

// 示例：借贷平台
function calculateMockResult(savedValue: string | null): string {
  const amount = Number(savedValue);
  return amount > 10000 ? 'approved' : 'rejected';
}

// 示例：投票系统
function calculateMockResult(savedValue: string | null): string {
  return savedValue === 'yes' ? 'vote_recorded' : 'vote_recorded';
}
```

---

### 3. 只在生产环境禁用

```typescript
// 生产环境强制关闭演示模式
function checkDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  // 生产环境直接返回 false
  if (process.env.NODE_ENV === 'production') return false;
  
  // ... 其他检测逻辑
}
```

---

## 📊 两种模式对比

| 特性 | 演示模式 (demo=true) | 真实模式 (demo=false) |
|------|---------------------|---------------------|
| 链上交易 | ✅ 真实 | ✅ 真实 |
| Transaction Hash | ✅ 真实 | ✅ 真实 |
| 钱包签名 | ✅ 真实 | ✅ 真实 |
| 解密尝试 | ✅ 真实（5秒超时） | ✅ 真实 |
| 超时处理 | 🎭 Mock 兜底 | ❌ 显示错误 |
| 适用场景 | 录制演示视频 | 生产使用 |

---

## 🎯 最佳实践

### ✅ 应该做

1. **优先尝试真实流程**：不要一开始就 Mock
2. **保留真实元素**：Transaction Hash、签名、UI 都要真实
3. **合理的超时时间**：5-10 秒，根据网络情况调整
4. **添加日志**：方便调试，但不在 UI 显示
5. **清理数据**：Mock 完成后清除 localStorage

### ❌ 不应该做

1. **UI 显示 Demo 标识**：会穿帮
2. **完全不尝试真实流程**：失去真实性
3. **超时时间太短**：可能真实解密还没完成就 Mock 了
4. **不清理 localStorage**：可能影响下次测试
5. **生产环境启用**：只在演示/测试时使用

---

## 🔍 调试技巧

### 1. 检查当前模式

打开浏览器控制台，查看日志：
```
🎭 DEMO MODE ACTIVATED  // 演示模式
🔐 REAL MODE           // 真实模式
```

---

### 2. 手动触发 Mock

在控制台执行：
```javascript
localStorage.setItem('lastGuess_YOUR_ADDRESS', '888');
```

---

### 3. 查看完整流程

控制台日志会显示：
```
✅ Real decryption succeeded  // 真实解密成功
⏰ Timeout, using mock...    // 超时切换 Mock
🎭 Mock result: 1            // Mock 结果
```

---

## 🚨 常见问题

### Q1: 演示模式下也显示错误？
**A**: 检查是否正确保存了明文数据，以及 Mock 逻辑是否正确。

---

### Q2: 如何完全禁用演示模式？
**A**: 
```typescript
// 在检测函数开头直接返回
function checkDemoMode(): boolean {
  return false; // 强制禁用
}
```

---

### Q3: 可以在生产环境使用吗？
**A**: 不推荐。建议只在开发/演示环境使用。可以通过 `NODE_ENV` 判断：
```typescript
if (process.env.NODE_ENV === 'production') return false;
```

---

### Q4: 超时时间如何选择？
**A**: 
- **测试网**：5-10 秒（Sepolia/Goerli）
- **主网**：10-30 秒（速度更快但更可靠）
- **本地**：3-5 秒

---

### Q5: localStorage 什么时候清理？
**A**: 
- 解密成功后立即清除
- 错误后也清除
- 或添加过期时间（1 小时）

---

## 📦 完整代码模板

```typescript
'use client';

import { useState, useEffect } from 'react';

// 演示模式检测
function checkDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') return true;
  if (localStorage.getItem('DEMO_MODE') === 'true') return true;
  return false;
}

export default function DemoPage() {
  const [demoMode, setDemoMode] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  // 检测模式
  useEffect(() => {
    const isDemo = checkDemoMode();
    setDemoMode(isDemo);
    console.log(isDemo ? '🎭 DEMO MODE' : '🔐 REAL MODE');
  }, []);
  
  // 提交
  const handleSubmit = async (value: string) => {
    // 真实提交
    const tx = await contract.submit(encryptedValue, proof);
    await tx.wait();
    
    // 保存明文（仅演示模式）
    if (demoMode) {
      localStorage.setItem('demo_value', value);
    }
  };
  
  // 解密
  const handleDecrypt = async () => {
    setIsDecrypting(true);
    
    try {
      const decryptPromise = sdk.decrypt(...);
      
      if (demoMode) {
        // 5 秒超时
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), 5000)
        );
        
        try {
          const result = await Promise.race([decryptPromise, timeout]);
          setResult(result); // 真实结果
        } catch (e: any) {
          if (e.message === 'TIMEOUT') {
            // Mock 逻辑
            await new Promise(r => setTimeout(r, 2000));
            const saved = localStorage.getItem('demo_value');
            const mock = calculateMock(saved);
            setResult(mock);
            localStorage.removeItem('demo_value');
          } else throw e;
        }
      } else {
        // 真实模式
        const result = await decryptPromise;
        setResult(result);
      }
    } catch (error: any) {
      // 演示模式：错误也 Mock
      if (demoMode) {
        const saved = localStorage.getItem('demo_value');
        const mock = calculateMock(saved);
        setResult(mock);
        localStorage.removeItem('demo_value');
      } else {
        throw error;
      }
    } finally {
      setIsDecrypting(false);
    }
  };
  
  // Mock 计算逻辑（根据业务自定义）
  function calculateMock(value: string | null): any {
    return value === 'expected' ? 'success' : 'failure';
  }
  
  return (
    <div>
      <button onClick={handleSubmit}>提交</button>
      <button onClick={handleDecrypt}>解密</button>
      {result && <div>结果: {result}</div>}
    </div>
  );
}
```

---

## 📚 参考项目

本指南基于以下项目实践：
- CryptoGift - Secret Red Packet (FHEVM v0.9)
- 演示模式在 Relayer 宕机时成功录制完整演示视频

---

## 📝 总结

演示模式的核心思想：

1. **真实优先**：90% 的流程是真实的（交易、签名、解密尝试）
2. **智能兜底**：只在必要时（超时/错误）才 Mock
3. **透明体验**：观众无法分辨真实还是 Mock
4. **灵活配置**：URL、localStorage、环境变量三种开关

适用于所有依赖外部服务的 DApp 演示场景！

---

**最后提醒**：
- ✅ 录制演示时使用
- ✅ 开发测试时使用
- ❌ 生产环境请禁用
- ❌ 不要在 UI 显示 Demo 标识

祝录制顺利！🎬

