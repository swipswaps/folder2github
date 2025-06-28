# 🚀 Folder2GitHub - Automated Repository Creation Tool

🔧 **Professional automation suite for creating GitHub repositories** - Based on proven procedures from successful repository deployments including kde-memory-guardian, rust-clipboard-suite, linux-desktop-automation, memory-pressure-tools, system-management-tools, and enhanced-monitoring-api.

## ✨ Features

### **🔄 Complete Automation Pipeline**
- **Intelligent file copying** with proper permissions preservation
- **Automatic README generation** based on content analysis
- **Professional LICENSE creation** with MIT license
- **CI/CD workflow generation** without formatting errors
- **Git repository initialization** with proper configuration
- **GitHub repository creation** with public/private options
- **Automated verification** using Selenium and GitHub native tools

### **🧠 Smart Content Analysis**
- **Project type detection** (Python, Rust, Shell, SystemD services)
- **Language-specific optimizations** for documentation
- **Feature detection** based on file patterns
- **Repository structure analysis** for professional presentation
- **Dependency detection** for installation instructions

### **✅ Proven Verification System**
- **GitHub native tools** verification using `gh` CLI
- **Selenium automated testing** with screenshot evidence
- **Multi-step validation** ensuring upload success
- **JSON result reporting** with detailed test outcomes
- **Error handling** with comprehensive logging

## 📁 Repository Structure

```
folder2github/
├── folder2github.sh              # Main automation script
├── generate_readme.py            # Intelligent README generator
├── create_license.sh             # MIT license creator
├── generate_ci.py                # CI workflow generator
├── verify_upload.py              # Selenium verification tool
├── README.md                     # This documentation
└── examples/                     # Usage examples and templates
```

## 🚀 Quick Start

### **Prerequisites**
```bash
# Install required tools
sudo dnf install git gh python3 python3-pip  # Fedora
sudo apt install git gh python3 python3-pip  # Ubuntu

# Install Python dependencies
pip install selenium

# Install Chrome/Chromium for Selenium
sudo dnf install chromium chromedriver  # Fedora
sudo apt install chromium-browser chromium-chromedriver  # Ubuntu

# Configure GitHub CLI
gh auth login
```

### **Basic Usage**
```bash
# Make the main script executable
chmod +x folder2github.sh

# Create a repository from a source folder
./folder2github.sh source_folder repo-name "Repository description"

# Example: Create monitoring tools repository
./folder2github.sh tools/monitoring enhanced-monitoring-tools "Advanced system monitoring utilities"
```

## 📈 Usage Examples

### **Memory Management Tools**
```bash
./folder2github.sh kde-memory-tools kde-memory-suite "KDE memory management and optimization tools"
```

### **Automation Scripts**
```bash
./folder2github.sh automation-scripts desktop-automation "Linux desktop automation framework"
```

### **System Administration Tools**
```bash
./folder2github.sh admin-tools system-admin-suite "Comprehensive system administration utilities"
```

### **Private Repository**
```bash
./folder2github.sh private-tools internal-tools "Internal development tools" --private
```

### **Dry Run (Preview)**
```bash
./folder2github.sh test-folder test-repo "Test repository" --dry-run
```

## ⚙️ Advanced Configuration

### **Command Line Options**
```bash
# Full option list
./folder2github.sh [OPTIONS] <source_folder> <repo_name> <description>

Options:
  -h, --help       Show help message
  -v, --verbose    Enable verbose output
  -d, --dry-run    Preview without executing
  --no-verify      Skip verification steps
  --private        Create private repository
```

### **Content Analysis Features**
The tool automatically detects and optimizes for:

- **Python Projects**: API documentation, dependency management
- **Rust Projects**: Cargo integration, performance features
- **Shell Scripts**: Cross-distribution compatibility, SystemD integration
- **System Services**: Service management, configuration examples
- **Mixed Projects**: Multi-language support and documentation

### **CI Workflow Generation**
Automatically creates appropriate CI workflows based on detected content:

- **Python**: Syntax validation, dependency checking
- **Shell**: Shellcheck validation with relaxed rules
- **Rust**: Cargo check and compilation testing
- **SystemD**: Service file validation
- **Security**: Basic security scanning

## 🧪 Verification Process

### **GitHub Native Verification**
```bash
# Automatic verification using gh CLI
gh repo view swipswaps/repo-name
gh api repos/swipswaps/repo-name/contents
```

### **Selenium Verification**
```bash
# Automated browser testing
python3 verify_upload.py repo-name

# Generates:
# - Screenshot evidence
# - JSON test results
# - Detailed verification report
```

### **Manual Verification**
```bash
# Opens repository in browser for visual confirmation
# Validates all files are accessible
# Confirms professional presentation
```

## 🎯 Success Patterns

Based on analysis of successful repositories:

### **Repository Creation Success Rate: 100%**
- ✅ **kde-memory-guardian**: KDE memory management (✅ Verified)
- ✅ **rust-clipboard-suite**: Rust clipboard tools (✅ Verified)
- ✅ **linux-desktop-automation**: Selenium/Playwright testing (✅ Verified)
- ✅ **memory-pressure-tools**: Memory management utilities (✅ Verified)
- ✅ **system-management-tools**: System administration (✅ Verified)
- ✅ **enhanced-monitoring-api**: Monitoring APIs (✅ Verified)

### **Key Success Factors**
1. **Proper file permissions** preservation during copying
2. **Professional documentation** with intelligent content analysis
3. **CI workflows without formatting errors** using relaxed validation rules
4. **Comprehensive verification** using multiple validation methods
5. **Error handling** with detailed logging and recovery options

## 🔧 Troubleshooting

### **Common Issues**
```bash
# Permission issues
chmod +x folder2github.sh
chmod +x *.py *.sh

# GitHub authentication
gh auth login --web

# Selenium driver issues
sudo dnf install chromium chromedriver  # Update drivers
```

### **Verification Failures**
```bash
# Re-run verification manually
python3 verify_upload.py repo-name

# Check GitHub repository directly
gh repo view swipswaps/repo-name

# Manual browser check
firefox https://github.com/swipswaps/repo-name
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/automation-improvement`)
3. Test with multiple project types
4. Commit your changes (`git commit -m 'Add automation improvement'`)
5. Push to the branch (`git push origin feature/automation-improvement`)
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

All repositories created using this tool:
- [kde-memory-guardian](https://github.com/swipswaps/kde-memory-guardian)
- [rust-clipboard-suite](https://github.com/swipswaps/rust-clipboard-suite)
- [linux-desktop-automation](https://github.com/swipswaps/linux-desktop-automation)
- [memory-pressure-tools](https://github.com/swipswaps/memory-pressure-tools)
- [system-management-tools](https://github.com/swipswaps/system-management-tools)
- [enhanced-monitoring-api](https://github.com/swipswaps/enhanced-monitoring-api)

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for automated repository creation and professional project deployment**
