# D-NAV Next.js App

A Next.js conversion of The Decision Navigator (D-NAV) - a tool for making clearer, data-driven decisions.

## Overview

This is a complete conversion of the original D-NAV HTML/CSS/JavaScript application to a modern Next.js application with TypeScript. The app helps users make better decisions by providing a structured framework for evaluating decisions across multiple dimensions.

## Features

### Core Functionality
- **Interactive Calculator**: Real-time D-NAV calculation with sliders for Impact, Cost, Risk, Urgency, and Confidence
- **Decision Metrics**: Automatic calculation of Return, Stability, Pressure, Merit, Energy, and Composite D-NAV scores
- **Archetype Classification**: 27 decision archetypes based on Pressure, Stability, and Return patterns
- **Coach Readout**: Intelligent coaching suggestions based on current decision profile

### Data Management
- **Decision Logging**: Save decisions with timestamps and categories
- **CSV Import/Export**: Import existing decision data or export for analysis
- **Local Storage**: All data persisted locally in the browser
- **Statistics Dashboard**: Comprehensive analytics including trends, consistency, and cadence metrics

### Advanced Features
- **Scenario Comparison**: Side-by-side comparison of different decision scenarios
- **Return Hygiene**: Track loss streaks, debt, and payback ratios
- **Portfolio Narrative**: AI-generated insights about decision patterns
- **Interactive Demo**: Guided walkthrough of the application

## Technical Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: React hooks (useState, useEffect)
- **Data Persistence**: localStorage API
- **Icons**: Lucide React

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles and CSS variables
│   ├── layout.tsx           # Root layout component
│   ├── page.tsx             # Main D-NAV calculator page
│   └── definitions/
│       └── page.tsx         # Definitions and archetypes page
├── components/
│   ├── DecisionCalculator.tsx  # Main calculator component
│   ├── SliderRow.tsx          # Individual slider component
│   ├── StatCard.tsx           # Statistics display component
│   └── SummaryCard.tsx        # Summary and archetype display
└── lib/
    ├── calculations.ts        # Core calculation logic and formulas
    └── storage.ts             # Local storage utilities
```

## Key Calculations

### Core Formula
```
D-NAV = (Impact − Cost − Risk) + (Urgency × Confidence)
```

### Derived Signals
- **Return**: Impact - Cost
- **Stability**: Confidence - Risk  
- **Pressure**: Urgency - Confidence
- **Merit**: Impact - Cost - Risk
- **Energy**: Urgency × Confidence

### Energy Tiers
- **Overdrive**: 71+ (Urgency × Confidence)
- **High**: 41-70
- **Moderate**: 16-40
- **Low**: 1-15

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dnav-nextjs
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

### Quality Checks

```bash
npm run check
```

If your build tooling reports a stale `baseline-browser-mapping`, refresh it with:

```bash
npm run baseline:refresh
```

## Usage

1. **Rate Your Decision**: Use the sliders to rate each variable (1-10) based on your current context
2. **Review Metrics**: See real-time calculations of Return, Stability, and Pressure
3. **Check Archetype**: Understand your decision's classification and characteristics
4. **Get Coaching**: Read the AI-generated coaching suggestions
5. **Log Decisions**: Save important decisions with names and categories
6. **Analyze Patterns**: Use the statistics dashboard to understand your decision-making patterns
7. **Compare Scenarios**: Use the Compare feature to evaluate different options

## Conversion Notes

This Next.js version maintains 100% feature parity with the original HTML/CSS/JavaScript version while providing:

- **Better Performance**: React's virtual DOM and Next.js optimizations
- **Type Safety**: Full TypeScript implementation
- **Maintainability**: Component-based architecture
- **Scalability**: Easy to extend with new features
- **Modern Tooling**: Hot reload, linting, and build optimizations

## Original Features Preserved

- All 27 decision archetypes with visual indicators
- Complete calculation engine with all formulas
- Interactive demo functionality
- CSV import/export capabilities
- Local storage persistence
- Responsive design for mobile and desktop
- Dark theme with custom styling
- All statistical analysis features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project maintains the same license as the original D-NAV application.

## Acknowledgments

- Original D-NAV concept and design
- Next.js and React communities
- Tailwind CSS for styling utilities
