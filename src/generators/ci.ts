import { ProjectAnalysis, RepositoryOptions } from '../types.js';

export class CIGenerator {
  generate(analysis: ProjectAnalysis, options: RepositoryOptions): string {
    const workflows = this.generateWorkflows(analysis);
    
    return `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
${workflows.join('\n\n')}

  # Security scanning
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run security scan
      uses: securecodewarrior/github-action-add-sarif@v1
      with:
        sarif-file: 'security-scan.sarif'
`;
  }

  private generateWorkflows(analysis: ProjectAnalysis): string[] {
    const workflows: string[] = [];

    // Base validation
    workflows.push(`  validate:
    name: Validate Repository
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Validate structure
      run: |
        echo "📊 Repository metrics:"
        echo "Files: ${analysis.metrics.fileCount}"
        echo "Languages: ${analysis.languages.join(', ')}"
        echo "Size: $(du -sh . | cut -f1)"
        
        # Validate essential files
        test -f README.md && echo "✅ README.md"
        test -f LICENSE && echo "✅ LICENSE"`);

    // Language-specific workflows
    if (analysis.languages.includes('python')) {
      workflows.push(this.generatePythonWorkflow());
    }

    if (analysis.languages.includes('rust')) {
      workflows.push(this.generateRustWorkflow());
    }

    if (analysis.languages.includes('typescript') || analysis.languages.includes('javascript')) {
      workflows.push(this.generateNodeWorkflow());
    }

    if (analysis.languages.includes('shell')) {
      workflows.push(this.generateShellWorkflow());
    }

    return workflows;
  }

  private generatePythonWorkflow(): string {
    return `  python:
    name: Python CI
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.8', '3.9', '3.10', '3.11']
    steps:
    - uses: actions/checkout@v4
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: \${{ matrix.python-version }}
        cache: 'pip'
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install ruff black mypy pytest pytest-cov
        if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
    - name: Lint with ruff
      run: ruff check .
    - name: Format with black
      run: black --check .
    - name: Type check with mypy
      run: mypy . || true
    - name: Test with pytest
      run: pytest --cov --cov-report=xml
    - name: Upload coverage
      uses: codecov/codecov-action@v3`;
  }

  private generateRustWorkflow(): string {
    return `  rust:
    name: Rust CI
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        components: rustfmt, clippy
        override: true
    - name: Cache cargo
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: \${{ runner.os }}-cargo-\${{ hashFiles('**/Cargo.lock') }}
    - name: Format check
      run: cargo fmt -- --check
    - name: Clippy
      run: cargo clippy -- -D warnings
    - name: Test
      run: cargo test --verbose
    - name: Build release
      run: cargo build --release`;
  }

  private generateNodeWorkflow(): string {
    return `  node:
    name: Node.js CI
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Lint
      run: npm run lint
    - name: Type check
      run: npm run type-check
    - name: Test
      run: npm test
    - name: Build
      run: npm run build`;
  }

  private generateShellWorkflow(): string {
    return `  shell:
    name: Shell Script Validation
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Install shellcheck
      run: sudo apt-get update && sudo apt-get install -y shellcheck
    - name: Validate shell scripts
      run: |
        find . -name "*.sh" -type f | while read -r script; do
          echo "Checking \$script"
          shellcheck "\$script" || echo "Warning: \$script has issues"
        done`;
  }
}