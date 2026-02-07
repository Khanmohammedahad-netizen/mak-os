"""
Quick start script - Runs both backend and frontend with one command
"""
import subprocess
import sys
import os

def main():
    print("🚀 Starting MAK OS V2...")
    
    # Check if we're in the right directory
    if not os.path.exists("backend") or not os.path.exists("frontend"):
        print("❌ Error: Must run from mak-os-v2/ root directory")
        sys.exit(1)
    
    print("\n📦 Installing backend dependencies...")
    subprocess.run(
        ["pip", "install", "-r", "requirements.txt"],
        cwd="backend",
        check=True
    )
    
    print("\n📦 Installing frontend dependencies...")
    subprocess.run(
        ["npm", "install"],
        cwd="frontend",
        check=True,
        shell=True
    )
    
    print("\n✅ Dependencies installed!")
    print("\n" + "=" * 60)
    print("🎯 Next steps:")
    print("=" * 60)
    print("\n1. Start Backend (Terminal 1):")
    print("   cd backend")
    print("   uvicorn app.main:app --reload")
    print("\n2. Start Frontend (Terminal 2):")
    print("   cd frontend")
    print("   npm run dev")
    print("\n3. Test Agents (Terminal 3):")
    print("   cd backend")
    print("   python test_agents.py")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
