"""
LUMI Diffusion Engine - Lightweight Text-to-Image Inference Service
Powered by segmind/tiny-sd with DPMSolverMultistepScheduler
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

def run_diffusion(prompt: str, output_path: str, steps: int = 8, guidance_scale: float = 7.0, width: int = 512, height: int = 512, upscale: bool = True):
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

        # Use fast DPM-Solver++ scheduler for crisp convergence in 8-12 steps
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

        # Ensure output directory exists
        out_dir = os.path.dirname(os.path.abspath(output_path))
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        # Generate image
        result = pipe(
            prompt=prompt,
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
    parser.add_argument("--steps", type=int, default=8, help="Number of inference steps (default 8)")
    parser.add_argument("--guidance", type=float, default=7.0, help="Classifier-free guidance scale")
    parser.add_argument("--width", type=int, default=512, help="Initial generation width")
    parser.add_argument("--height", type=int, default=512, help="Initial generation height")
    parser.add_argument("--no-upscale", action="store_true", help="Disable upscaling to 1024x1024")

    args = parser.parse_args()
    code = run_diffusion(
        prompt=args.prompt,
        output_path=args.output,
        steps=args.steps,
        guidance_scale=args.guidance,
        width=args.width,
        height=args.height,
        upscale=not args.no_upscale
    )
    sys.exit(code)
