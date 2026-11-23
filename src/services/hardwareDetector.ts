export interface HardwareProfile {
  cpu: {
    model: string;
    cores: number;
    threads: number;
    arch: string;
  };
  ram: {
    totalGB: number;
    freeGB: number;
    usedGB: number;
  };
  gpu: {
    detected: boolean;
    vendor: 'NVIDIA' | 'AMD' | 'Apple' | 'Intel' | 'None';
    name: string;
    totalVramMB: number;
    freeVramMB: number;
    driverVersion: string;
    cudaSupported: boolean;
  };
  storage: {
    freeGB: number;
    modelStoragePath: string;
  };
  os: {
    platform: string;
    release: string;
    arch: string;
  };
  tier: 'low-end' | 'mid-range-laptop' | 'high-end' | 'enterprise';
  tierLabel: string;
  constraints: {
    maxSafeVramGB: number;
    maxSafeRamGB: number;
    maxContextTokens: number;
    concurrencySlots: number;
  };
  recommendedModels: Array<{
    id: string;
    name: string;
    role: 'code' | 'chat' | 'embedding' | 'vision';
    parameterSize: string;
    quantization: string;
    vramRequiredMB: number;
    vramUsedMB?: number;
    contextWindow: string;
    runMode: 'GPU (CUDA)' | 'CPU (AVX-512)';
    status: 'loaded' | 'unloaded';
  }>;
}

// Baseline profile reflecting local hardware
export const DEFAULT_HARDWARE_PROFILE: HardwareProfile = {
  cpu: {
    model: 'AMD Ryzen 5 4600H with Radeon Graphics',
    cores: 6,
    threads: 12,
    arch: 'x64'
  },
  ram: {
    totalGB: 15.4,
    freeGB: 3.7,
    usedGB: 11.7
  },
  gpu: {
    detected: false,
    vendor: 'None',
    name: 'Integrated CPU Compute Only',
    totalVramMB: 0,
    freeVramMB: 0,
    driverVersion: 'N/A',
    cudaSupported: false
  },
  storage: {
    freeGB: 120,
    modelStoragePath: 'local/models'
  },
  os: {
    platform: 'win32',
    release: '10.0',
    arch: 'x64'
  },
  tier: 'low-end',
  tierLabel: 'CPU-Optimized Laptop (16GB RAM)',
  constraints: {
    maxSafeVramGB: 0,
    maxSafeRamGB: 8.0,
    maxContextTokens: 32768,
    concurrencySlots: 2
  },
  recommendedModels: [
    {
      id: 'qwen2.5:1.5b',
      name: 'Qwen2.5 1.5B',
      role: 'chat',
      parameterSize: '1.5B',
      quantization: 'Q4_K_M',
      vramRequiredMB: 980,
      contextWindow: '32K',
      runMode: 'CPU (AVX-512)',
      status: 'loaded'
    },
    {
      id: 'qwen2.5-coder:1.5b',
      name: 'Qwen2.5-Coder 1.5B',
      role: 'code',
      parameterSize: '1.5B',
      quantization: 'Q4_K_M',
      vramRequiredMB: 980,
      contextWindow: '32K',
      runMode: 'CPU (AVX-512)',
      status: 'loaded'
    },
    {
      id: 'nomic-embed-text',
      name: 'Nomic Embed Text',
      role: 'embedding',
      parameterSize: '137M',
      quantization: 'F16',
      vramRequiredMB: 280,
      vramUsedMB: 280,
      contextWindow: '8K',
      runMode: 'CPU (AVX-512)',
      status: 'loaded'
    },
    {
      id: 'moondream:latest',
      name: 'Moondream Vision',
      role: 'vision',
      parameterSize: '1.8B',
      quantization: 'Q4_K_M',
      vramRequiredMB: 1700,
      contextWindow: '8K',
      runMode: 'CPU (AVX-512)',
      status: 'loaded'
    }
  ]
};

/**
 * Detect hardware dynamically from the local Vite / Express backend endpoint,
 * falling back gracefully to probed specifications if offline.
 */
export async function detectSystemHardware(): Promise<HardwareProfile> {
  try {
    const res = await fetch('/api/hardware', {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return calculateOptimalHardwareProfile(data);
    }
  } catch (err) {
    // API not reachable or running client-only
  }
  return DEFAULT_HARDWARE_PROFILE;
}

/**
 * Hardware adaptive tier calculation logic
 */
export function calculateOptimalHardwareProfile(raw: Partial<HardwareProfile>): HardwareProfile {
  const totalRamGB = raw.ram?.totalGB ?? 15.4;
  const gpu = raw.gpu ?? DEFAULT_HARDWARE_PROFILE.gpu;
  const cpu = raw.cpu ?? DEFAULT_HARDWARE_PROFILE.cpu;

  let tier: HardwareProfile['tier'] = 'mid-range-laptop';
  let tierLabel = 'Mid-Range Laptop';
  let maxSafeVramGB = 3.2;
  let maxSafeRamGB = 8.0;

  if (!gpu.detected || gpu.totalVramMB < 2048) {
    tier = 'low-end';
    tierLabel = 'Low-End Workstation (CPU-bound)';
    maxSafeVramGB = 0;
    maxSafeRamGB = Math.max(4.0, totalRamGB * 0.5);
  } else if (gpu.totalVramMB >= 12000) {
    tier = 'high-end';
    tierLabel = 'High-End Workstation (12GB+ VRAM)';
    maxSafeVramGB = (gpu.totalVramMB / 1024) * 0.85;
    maxSafeRamGB = totalRamGB * 0.7;
  } else if (gpu.totalVramMB >= 8000) {
    tier = 'mid-range-laptop';
    tierLabel = 'Performance Workstation (8GB VRAM)';
    maxSafeVramGB = 6.4;
    maxSafeRamGB = totalRamGB * 0.6;
  } else {
    // 4GB VRAM laptop (GTX 1650 tier)
    tier = 'mid-range-laptop';
    tierLabel = 'Mid-Range Laptop (4GB VRAM, 16GB RAM)';
    maxSafeVramGB = 3.2;
    maxSafeRamGB = 8.0;
  }

  return {
    cpu: {
      model: cpu.model || 'AMD Ryzen 5 4600H with Radeon Graphics',
      cores: cpu.cores || 6,
      threads: cpu.threads || 12,
      arch: cpu.arch || 'x64'
    },
    ram: {
      totalGB: totalRamGB,
      freeGB: raw.ram?.freeGB ?? 3.7,
      usedGB: +(totalRamGB - (raw.ram?.freeGB ?? 3.7)).toFixed(1)
    },
    gpu: {
      detected: Boolean(gpu.detected),
      vendor: gpu.vendor || (gpu.detected ? 'NVIDIA' : 'None'),
      name: gpu.name || (gpu.detected ? 'Discrete GPU' : 'Integrated CPU Compute Only'),
      totalVramMB: gpu.totalVramMB || 0,
      freeVramMB: gpu.freeVramMB || 0,
      driverVersion: gpu.driverVersion || 'N/A',
      cudaSupported: Boolean(gpu.cudaSupported)
    },
    storage: {
      freeGB: raw.storage?.freeGB ?? 142,
      modelStoragePath: raw.storage?.modelStoragePath || 'local/models'
    },
    os: {
      platform: raw.os?.platform || 'win32',
      release: raw.os?.release || '10.0.26200',
      arch: raw.os?.arch || 'x64'
    },
    tier,
    tierLabel,
    constraints: {
      maxSafeVramGB,
      maxSafeRamGB,
      maxContextTokens: tier === 'low-end' ? 8192 : 32768,
      concurrencySlots: tier === 'low-end' ? 1 : 2
    },
    recommendedModels: DEFAULT_HARDWARE_PROFILE.recommendedModels
  };
}
