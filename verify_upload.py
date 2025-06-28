#!/usr/bin/env python3
"""
✅ GitHub Upload Verification for folder2github
Automated verification using Selenium based on successful patterns
"""

import time
import json
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def verify_github_repository(repo_name):
    """Verify repository upload using proven Selenium patterns"""
    
    print(f"✅ STARTING VERIFICATION FOR {repo_name.upper()}")
    print("=" * 60)
    
    # Setup Chrome options (proven configuration)
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    
    verification_results = {
        "timestamp": datetime.now().isoformat(),
        "repository_url": f"https://github.com/swipswaps/{repo_name}",
        "tests": {},
        "overall_status": "UNKNOWN"
    }
    
    try:
        # Initialize WebDriver
        driver = webdriver.Chrome(options=chrome_options)
        wait = WebDriverWait(driver, 10)
        
        print(f"🌐 Opening GitHub repository: {repo_name}")
        driver.get(f"https://github.com/swipswaps/{repo_name}")
        
        # Test 1: Repository exists and loads
        try:
            repo_title = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))
            print(f"✅ Repository title found: {repo_title.text}")
            verification_results["tests"]["repository_exists"] = {
                "status": "PASS",
                "title": repo_title.text
            }
        except Exception as e:
            print(f"❌ Repository title not found: {e}")
            verification_results["tests"]["repository_exists"] = {
                "status": "FAIL",
                "error": str(e)
            }
        
        # Test 2: Check for essential files
        essential_files = ["README.md", "LICENSE"]
        
        essential_results = {}
        for file in essential_files:
            try:
                file_link = driver.find_element(By.LINK_TEXT, file)
                print(f"✅ Essential file found: {file}")
                essential_results[file] = "FOUND"
            except:
                print(f"⚠️ Essential file not visible: {file}")
                essential_results[file] = "NOT_VISIBLE"
        
        verification_results["tests"]["essential_files"] = {
            "status": "PASS" if all(v == "FOUND" for v in essential_results.values()) else "PARTIAL",
            "files": essential_results
        }
        
        # Test 3: Check for project files (flexible detection)
        project_files = []
        try:
            # Look for common file types
            file_links = driver.find_elements(By.CSS_SELECTOR, "a[title$='.py'], a[title$='.sh'], a[title$='.rs'], a[title$='.service']")
            for link in file_links[:5]:  # Limit to first 5 files
                file_name = link.get_attribute("title")
                if file_name:
                    project_files.append(file_name)
                    print(f"✅ Project file found: {file_name}")
        except Exception as e:
            print(f"⚠️ Error detecting project files: {e}")
        
        verification_results["tests"]["project_files"] = {
            "status": "PASS" if len(project_files) > 0 else "WARN",
            "count": len(project_files),
            "files": project_files
        }
        
        # Test 4: Check repository description
        try:
            description = driver.find_element(By.CSS_SELECTOR, "[data-pjax='#repo-content-pjax-container'] p")
            desc_text = description.text
            print(f"✅ Repository description: {desc_text[:100]}...")
            verification_results["tests"]["description"] = {
                "status": "PASS",
                "text": desc_text
            }
        except Exception as e:
            print(f"⚠️ Repository description not found: {e}")
            verification_results["tests"]["description"] = {
                "status": "WARN",
                "error": str(e)
            }
        
        # Test 5: Check commit count
        try:
            commits_element = driver.find_element(By.CSS_SELECTOR, "[href*='/commits/']")
            commits_text = commits_element.text
            print(f"✅ Commits found: {commits_text}")
            verification_results["tests"]["commits"] = {
                "status": "PASS",
                "text": commits_text
            }
        except Exception as e:
            print(f"⚠️ Commits information not found: {e}")
            verification_results["tests"]["commits"] = {
                "status": "WARN",
                "error": str(e)
            }
        
        # Test 6: Check for CI workflow
        try:
            # Look for .github directory or Actions tab
            actions_indicators = driver.find_elements(By.XPATH, "//*[contains(text(), 'Actions') or contains(text(), '.github')]")
            if actions_indicators:
                print("✅ CI/Actions integration detected")
                verification_results["tests"]["ci_integration"] = {
                    "status": "PASS",
                    "found": True
                }
            else:
                print("⚠️ CI/Actions integration not detected")
                verification_results["tests"]["ci_integration"] = {
                    "status": "WARN",
                    "found": False
                }
        except Exception as e:
            print(f"⚠️ CI integration check error: {e}")
            verification_results["tests"]["ci_integration"] = {
                "status": "WARN",
                "error": str(e)
            }
        
        # Test 7: Content verification
        try:
            page_content = driver.page_source.lower()
            if repo_name.lower() in page_content:
                print(f"✅ Repository content verified for {repo_name}")
                verification_results["tests"]["content_verification"] = {
                    "status": "PASS",
                    "contains_repo_name": True
                }
            else:
                print(f"⚠️ Repository content not fully verified for {repo_name}")
                verification_results["tests"]["content_verification"] = {
                    "status": "WARN",
                    "contains_repo_name": False
                }
        except Exception as e:
            print(f"⚠️ Content verification error: {e}")
            verification_results["tests"]["content_verification"] = {
                "status": "WARN",
                "error": str(e)
            }
        
        # Test 8: Take screenshot as evidence
        screenshot_filename = f"{repo_name}_verification_{int(time.time())}.png"
        driver.save_screenshot(screenshot_filename)
        print(f"📸 Screenshot saved: {screenshot_filename}")
        verification_results["screenshot"] = screenshot_filename
        
        # Determine overall status
        test_statuses = [test["status"] for test in verification_results["tests"].values()]
        pass_count = sum(1 for status in test_statuses if status == "PASS")
        total_count = len(test_statuses)
        
        if pass_count >= total_count * 0.8:  # 80% pass rate
            verification_results["overall_status"] = "SUCCESS"
            print(f"\n🎉 VERIFICATION SUCCESSFUL! ({pass_count}/{total_count} tests passed)")
        elif pass_count >= total_count * 0.6:  # 60% pass rate
            verification_results["overall_status"] = "PARTIAL"
            print(f"\n⚠️ PARTIAL SUCCESS ({pass_count}/{total_count} tests passed)")
        else:
            verification_results["overall_status"] = "FAILED"
            print(f"\n❌ VERIFICATION FAILED ({pass_count}/{total_count} tests passed)")
        
    except Exception as e:
        print(f"💥 CRITICAL ERROR: {e}")
        verification_results["tests"]["critical_error"] = {
            "status": "FAIL",
            "error": str(e)
        }
        verification_results["overall_status"] = "FAILED"
    
    finally:
        if 'driver' in locals():
            driver.quit()
    
    # Save results to JSON
    results_filename = f"verification_results_{int(time.time())}.json"
    with open(results_filename, 'w') as f:
        json.dump(verification_results, f, indent=2)
    
    print(f"\n📊 Results saved to: {results_filename}")
    print("=" * 60)
    
    return verification_results

def main():
    if len(sys.argv) != 2:
        print("Usage: verify_upload.py <repo_name>")
        sys.exit(1)
    
    repo_name = sys.argv[1]
    results = verify_github_repository(repo_name)
    
    # Print summary
    print(f"\n🎯 FINAL RESULT: {results['overall_status']}")
    print(f"🔗 Repository: {results['repository_url']}")
    print(f"⏰ Verified at: {results['timestamp']}")
    
    # Exit with appropriate code
    if results['overall_status'] == "SUCCESS":
        exit(0)
    elif results['overall_status'] == "PARTIAL":
        exit(1)
    else:
        exit(2)

if __name__ == "__main__":
    main()
