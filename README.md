# Arcade Cosmic Defender

A retro-style space shooter arcade game built with React and HTML5 Canvas. Defend the cosmos from waves of alien invaders, collect power-ups, and aim for the high score!

## Features

- **Classic Arcade Action**: Fast-paced shooting mechanics with increasing difficulty.
- **Dynamic Visuals**: 
  - 3D-styled ship rendering using 2D Canvas methods.
  - Parallax star background.
  - Particle effects for explosions and propulsion.
- **Power-ups**:
  - **Triple Shot**: Fires three bullets at once for damage maximization.
  - **Shield**: Restores lost lives (up to 5 max).
- **Controls**:
  - **Keyboard**: Arrow Keys or WASD to move, Spacebar to shoot.
  - **Touch**: Drag to move and shoot on touch-enabled devices.
- **Audio**: Real-time synthesized sound effects (shoot, explosions, power-ups) using the Web Audio API.

## Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Graphics**: HTML5 Canvas API
- **Audio**: Web Audio API
- **Icons**: Custom inline SVG rendering

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd arcade-cosmic-defender
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Running the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the game:**
   Open your browser and navigate to `http://localhost:5173` (or the URL shown in your terminal).

## How to Play

1. **Start**: Enter your name and click "Start Mission".
2. **Move**: Use Arrow Keys or `WASD` to maneuver your ship.
3. **Shoot**: Press `Spacebar` to fire lasers.
4. **Survive**: Destroy enemies to increase your score. Avoid collisions with enemy ships!
5. **Power-up**: Collect floating icons to upgrade your ship's weapons or restore health.

## Project Structure

- `src/App.jsx`: Contains the core game loop, rendering logic (Canvas), and state management.
- `src/index.css`: Global styles and Tailwind CSS configuration.
- `src/main.jsx`: Application entry point.
