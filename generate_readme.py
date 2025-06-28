#!/usr/bin/env python3
"""
📝 README Generator for folder2github
Automatically generates professional README.md files based on repository content analysis
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

def analyze_repository_content(target_dir):
    """Analyze repository content to determine type and features"""
    
    analysis = {
        "type": "general",
        "languages": [],
        "features": [],
        "files": {
            "scripts": [],
            "configs": [],
            "docs": [],
            "services": []
        }
    }
    
    # Analyze files
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, target_dir)
            
            # Language detection
            if file.endswith('.py'):
                analysis["languages"].append("Python")
                analysis["files"]["scripts"].append(rel_path)
            elif file.endswith('.sh'):
                analysis["languages"].append("Shell")
                analysis["files"]["scripts"].append(rel_path)
            elif file.endswith('.rs'):
                analysis["languages"].append("Rust")
                analysis["files"]["scripts"].append(rel_path)
            elif file.endswith(('.service', '.timer')):
                analysis["files"]["services"].append(rel_path)
            elif file.endswith(('.conf', '.json', '.yaml', '.yml')):
                analysis["files"]["configs"].append(rel_path)
            elif file.endswith(('.md', '.txt', '.rst')):
                analysis["files"]["docs"].append(rel_path)
    
    # Remove duplicates
    analysis["languages"] = list(set(analysis["languages"]))
    
    # Determine repository type
    if any("memory" in f.lower() for f in analysis["files"]["scripts"]):
        analysis["type"] = "memory-management"
    elif any("monitoring" in f.lower() or "api" in f.lower() for f in analysis["files"]["scripts"]):
        analysis["type"] = "monitoring-api"
    elif any("automation" in f.lower() or "test" in f.lower() for f in analysis["files"]["scripts"]):
        analysis["type"] = "automation"
    elif any("clipboard" in f.lower() for f in analysis["files"]["scripts"]):
        analysis["type"] = "clipboard"
    elif any("plasma" in f.lower() or "kde" in f.lower() for f in analysis["files"]["scripts"]):
        analysis["type"] = "kde-tools"
    elif analysis["files"]["services"]:
        analysis["type"] = "system-management"
    
    return analysis

def generate_readme_content(repo_name, description, analysis):
    """Generate README content based on analysis"""
    
    # Determine emoji and title based on type
    type_config = {
        "memory-management": {"emoji": "🧠", "title": "Memory Management"},
        "monitoring-api": {"emoji": "📊", "title": "Monitoring API"},
        "automation": {"emoji": "🧪", "title": "Automation Framework"},
        "clipboard": {"emoji": "📋", "title": "Clipboard Management"},
        "kde-tools": {"emoji": "🖥️", "title": "KDE Tools"},
        "system-management": {"emoji": "🛠️", "title": "System Management"},
        "general": {"emoji": "⚙️", "title": "Development Tools"}
    }
    
    config = type_config.get(analysis["type"], type_config["general"])
    
    readme_content = f"""# {config["emoji"]} {repo_name.replace('-', ' ').title()}

{config["emoji"]} **{description}**

## ✨ Features

### **🔧 Core Functionality**
"""
    
    # Add type-specific features
    if analysis["type"] == "memory-management":
        readme_content += """- **Memory usage monitoring** and optimization
- **Leak detection** and prevention
- **Performance analysis** and reporting
- **Automated cleanup** and maintenance
"""
    elif analysis["type"] == "monitoring-api":
        readme_content += """- **Real-time monitoring** and metrics collection
- **RESTful API endpoints** for integration
- **Historical data** analysis and reporting
- **Alert system** for threshold monitoring
"""
    elif analysis["type"] == "automation":
        readme_content += """- **Automated testing** frameworks
- **Cross-platform compatibility** testing
- **Evidence collection** and reporting
- **Integration testing** capabilities
"""
    elif analysis["type"] == "clipboard":
        readme_content += """- **Advanced clipboard management** functionality
- **Multi-format support** for various data types
- **History tracking** and management
- **Cross-platform compatibility**
"""
    elif analysis["type"] == "kde-tools":
        readme_content += """- **KDE Plasma optimization** tools
- **Desktop environment** management
- **Cache management** and cleanup
- **Performance optimization** utilities
"""
    elif analysis["type"] == "system-management":
        readme_content += """- **System administration** tools
- **Service management** and monitoring
- **Configuration management** utilities
- **Automated maintenance** tasks
"""
    else:
        readme_content += """- **Professional development** tools and utilities
- **Cross-platform compatibility** support
- **Automated workflows** and processes
- **Comprehensive documentation** and examples
"""
    
    # Add language-specific features
    if "Python" in analysis["languages"]:
        readme_content += """
### **🐍 Python Integration**
- **Modern Python 3** compatibility
- **Professional API design** with proper error handling
- **Comprehensive logging** and debugging support
- **Modular architecture** for easy extension
"""
    
    if "Rust" in analysis["languages"]:
        readme_content += """
### **🦀 Rust Performance**
- **Memory-safe implementation** with zero-cost abstractions
- **High-performance execution** with minimal overhead
- **Cross-platform compilation** support
- **Modern Rust ecosystem** integration
"""
    
    if "Shell" in analysis["languages"]:
        readme_content += """
### **🐚 Shell Script Automation**
- **Cross-distribution compatibility** (Fedora, Ubuntu, Arch)
- **Robust error handling** and logging
- **SystemD integration** for service management
- **Automated installation** and configuration
"""
    
    # Repository structure
    readme_content += f"""
## 📁 Repository Structure

```
{repo_name}/
"""
    
    # Add structure based on files found
    if analysis["files"]["scripts"]:
        readme_content += "├── scripts/\n"
        for script in analysis["files"]["scripts"][:3]:
            readme_content += f"│   ├── {os.path.basename(script):<30} # Core functionality\n"
        if len(analysis["files"]["scripts"]) > 3:
            readme_content += f"│   └── ... ({len(analysis['files']['scripts']) - 3} more files)\n"
    
    if analysis["files"]["services"]:
        readme_content += "├── services/\n"
        for service in analysis["files"]["services"]:
            readme_content += f"│   ├── {os.path.basename(service):<30} # SystemD service\n"
    
    if analysis["files"]["configs"]:
        readme_content += "├── config/\n"
        for config in analysis["files"]["configs"][:2]:
            readme_content += f"│   ├── {os.path.basename(config):<30} # Configuration\n"
    
    readme_content += """├── docs/                              # Documentation
└── README.md                          # This file
```

## 🚀 Quick Start

### **Prerequisites**
```bash
"""
    
    # Add language-specific prerequisites
    if "Python" in analysis["languages"]:
        readme_content += """# Python dependencies
pip install -r requirements.txt

"""
    
    if "Rust" in analysis["languages"]:
        readme_content += """# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

"""
    
    readme_content += """# System dependencies (Ubuntu/Debian)
sudo apt update && sudo apt install -y git curl

# System dependencies (Fedora)
sudo dnf install -y git curl
```

### **Installation**
```bash
# Clone the repository
git clone https://github.com/swipswaps/{repo_name}.git
cd {repo_name}

# Make scripts executable
chmod +x *.sh
""".format(repo_name=repo_name)
    
    # Add type-specific installation steps
    if analysis["files"]["services"]:
        readme_content += """
# Install SystemD services
sudo cp *.service *.timer /etc/systemd/system/ 2>/dev/null || true
sudo systemctl daemon-reload
"""
    
    readme_content += """```

## 📈 Usage Examples

"""
    
    # Add usage examples based on file types
    if any("test" in f.lower() for f in analysis["files"]["scripts"]):
        readme_content += """### **Testing Framework**
```bash
# Run automated tests
./run_tests.sh

# Generate test reports
./generate_reports.sh
```

"""
    
    if any("api" in f.lower() for f in analysis["files"]["scripts"]):
        readme_content += """### **API Usage**
```bash
# Start the API server
python3 api_server.py

# Test API endpoints
curl http://localhost:8080/api/status
```

"""
    
    if analysis["files"]["services"]:
        readme_content += """### **Service Management**
```bash
# Enable and start services
sudo systemctl enable service-name.service
sudo systemctl start service-name.service

# Check service status
systemctl status service-name.service
```

"""
    
    # Add configuration section
    readme_content += """## ⚙️ Configuration

### **Basic Configuration**
```bash
# Edit configuration files
nano config/settings.conf

# Apply configuration changes
./apply_config.sh
```

## 🧪 Testing & Validation

```bash
# Run comprehensive tests
./test_suite.sh

# Validate installation
./validate_setup.sh

# Performance testing
./performance_test.sh
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/enhancement`)
3. Commit your changes (`git commit -m 'Add enhancement'`)
4. Push to the branch (`git push origin feature/enhancement`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [kde-memory-guardian](https://github.com/swipswaps/kde-memory-guardian) - KDE memory management
- [performance-monitoring-suite](https://github.com/swipswaps/performance-monitoring-suite) - Performance analysis
- [system-management-tools](https://github.com/swipswaps/system-management-tools) - System administration

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for the Linux community**"""
    
    return readme_content

def main():
    if len(sys.argv) != 4:
        print("Usage: generate_readme.py <target_dir> <repo_name> <description>")
        sys.exit(1)
    
    target_dir = sys.argv[1]
    repo_name = sys.argv[2]
    description = sys.argv[3]
    
    # Analyze repository content
    analysis = analyze_repository_content(target_dir)
    
    # Generate README content
    readme_content = generate_readme_content(repo_name, description, analysis)
    
    # Write README.md
    readme_path = os.path.join(target_dir, "README.md")
    with open(readme_path, 'w') as f:
        f.write(readme_content)
    
    print(f"✅ Generated README.md for {repo_name}")
    print(f"📊 Repository type: {analysis['type']}")
    print(f"🔧 Languages: {', '.join(analysis['languages'])}")

if __name__ == "__main__":
    main()
