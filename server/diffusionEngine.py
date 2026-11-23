"""
LUMI Diffusion Engine - Lightweight Text-to-Image Inference Service
Powered by segmind/tiny-sd with DPMSolverMultistepScheduler and Professional Negative Prompting
"""

import sys
import os
import time
import json
import argparse
import warnings

# Suppress HuggingFace and Diffusers deprecation/symlink warnings
warnings.filterwarnings("ignore")
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "true"

DEFAULT_NEGATIVE_PROMPT = (
    "deformed, distorted, disfigured, bad anatomy, bad proportions, unnatural body, "
    "weird limbs, mannequin, cutout, blurry, grainy, low resolution, multiple figures, "
    "mutated hands, poorly drawn face, worst quality, extra limbs, ugly"
)

def enhance_prompt(prompt: str) -> str:
    p = prompt.strip()
    lower = p.toLowerCase() if hasattr(p, 'toLowerCase') else p.lower()
    # Strip conversational prefixes if present
    for prefix in ['generate an image of ', 'generate a picture of ', 'create an image of ', 'draw a picture of ', 'draw an image of ', 'image of ']:
        if lower.startswith(prefix):
            p = p[len(prefix):].strip()
            break
            
    # If prompt already contains quality modifiers, keep intact
    if any(q in lower for q in ['photorealistic', '8k', 'cinematic', 'hyperrealistic', 'dslr', 'masterpiece']):
        return p
        
    return f"high quality professional photograph of {p}, sharp focus, detailed features, expressive eyes, realistic textures, cinematic lighting, 8k uhd, photorealistic"

def run_diffusion(
    prompt: str,
    output_path: str,
    steps: int = 12,
    guidance_scale: float = 7.5,
    width: int = 512,
    height: int = 512,
    upscale: bool = True,
    negative_prompt: str = DEFAULT_NEGATIVE_PROMPT
):
    start_time = time.time()
    try:
        import torch
        from PIL import Image
        from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

        # Optimize CPU threads for multi-core processors
        try:
            torch.set_num_threads(max(4, os.cpu_count() or 4))
        except Exception:
            pass

        model_id = "segmind/tiny-sd"

        # Load pipeline from cached local weights
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
            safety_checker=None,
            requires_safety_checker=False
        )

        # Fast DPM-Solver++ scheduler for clean convergence in 10-14 steps
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

        # Ensure output directory exists
        out_dir = os.path.dirname(os.path.abspath(output_path))
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        final_prompt = enhance_prompt(prompt)

        # Generate image with negative prompt conditioning
        result = pipe(
            prompt=final_prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            width=width,
            height=height
        )

        image = result.images[0]

        # Upscale to 1024x1024 for high-resolution deliverable display
        final_w, final_h = width, height
        if upscale and (width < 1024 or height < 1024):
            image = image.resize((1024, 1024), Image.Resampling.LANCZOS)
            final_w, final_h = 1024, 1024

        image.save(output_path, "PNG")
        duration_ms = int((time.time() - start_time) * 1000)

        output = {
            "success": True,
            "filePath": os.path.abspath(output_path),
            "model": model_id,
            "promptUsed": final_prompt,
            "steps": steps,
            "width": final_w,
            "height": final_h,
            "durationMs": duration_ms
        }
        print(json.dumps(output))
        return 0

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        output = {
            "success": False,
            "error": str(e),
            "durationMs": duration_ms
        }
        print(json.dumps(output))
        return 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LUMI Local Diffusion Engine")
    parser.add_argument("--prompt", type=str, required=True, help="Text prompt for image generation")
    parser.add_argument("--output", type=str, required=True, help="Destination PNG file path")
    parser.add_argument("--steps", type=int, default=12, help="Number of inference steps (default 12)")
    parser.add_argument("--guidance", type=float, default=7.5, help="Classifier-free guidance scale")
    parser.add_argument("--width", type=int, default=512, help="Initial generation width")
    parser.add_argument("--height", type=int, default=512, help="Initial generation height")
    parser.add_argument("--negative-prompt", type=str, default=DEFAULT_NEGATIVE_PROMPT, help="Negative prompt")
    parser.add_argument("--no-upscale", action="store_true", help="Disable upscaling to 1024x1024")

    args = parser.parse_args()
    code = run_diffusion(
        prompt=args.prompt,
        output_path=args.output,
        steps=args.steps,
        guidance_scale=args.guidance,
        width=args.width,
        height=args.height,
        upscale=not args.no_upscale,
        negative_prompt=args.negative_prompt
    )
    sys.exit(code)
