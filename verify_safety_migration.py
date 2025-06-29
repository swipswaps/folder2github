#!/usr/bin/env python3
"""
🔍 FOLDER2GITHUB SAFETY MIGRATION VERIFICATION
Verifies that safety features are properly installed and working
Created: 2025-06-29T17:21:36.914729
"""

import subprocess
import os
import sys

def check_file_exists(filepath, description):
    """Check if a file exists and is executable"""
    if os.path.exists(filepath):
        if os.access(filepath, os.X_OK):
            print(f"✅ {description}: {filepath}")
            return True
        else:
            print(f"⚠️  {description}: {filepath} (not executable)")
            return False
    else:
        print(f"❌ {description}: {filepath} (missing)")
        return False

def test_safety_features():
    """Test that safety features are working"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    safe_script = os.path.join(script_dir, "folder2github_safe.sh")
    
    if not os.path.exists(safe_script):
        print("❌ Cannot test: folder2github_safe.sh not found")
        return False
    
    try:
        # Test help functionality
        result = subprocess.run([safe_script, "--help"], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and "--backup" in result.stdout:
            print("✅ Safety features: Help shows safety options")
            return True
        else:
            print("❌ Safety features: Help not working properly")
            return False
    except Exception as e:
        print(f"❌ Safety features: Test failed - {e}")
        return False

def main():
    print("🔍 FOLDER2GITHUB SAFETY MIGRATION VERIFICATION")
    print("=" * 60)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Check required files
    files_to_check = [
        (os.path.join(script_dir, "folder2github.sh"), "Main script (safe by default)"),
        (os.path.join(script_dir, "folder2github_safe.sh"), "Enhanced safe script"),
        (os.path.join(script_dir, "folder2github_unsafe.sh"), "Original unsafe script"),
        (os.path.join(script_dir, "folder2github_wrapper.sh"), "Safety wrapper script"),
        (os.path.join(script_dir, "README.md"), "Updated documentation"),
        (os.path.join(script_dir, "SAFETY_GUIDE.md"), "Safety guide")
    ]
    
    passed = 0
    total = len(files_to_check)
    
    for filepath, description in files_to_check:
        if check_file_exists(filepath, description):
            passed += 1
    
    # Test safety features
    if test_safety_features():
        passed += 1
    total += 1
    
    print("\n" + "=" * 60)
    print(f"📊 VERIFICATION RESULTS: {passed}/{total} checks passed")
    
    if passed == total:
        print("🎉 MIGRATION SUCCESSFUL!")
        print("✅ All safety features are properly installed and working")
        print("\n💡 USAGE RECOMMENDATIONS:")
        print("   ./folder2github.sh          - Safe by default")
        print("   ./folder2github_safe.sh     - Enhanced safety features")
        print("   ./folder2github_unsafe.sh   - Original behavior (use with caution)")
        return True
    else:
        print("⚠️  MIGRATION INCOMPLETE")
        print("❌ Some safety features are missing or not working")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
