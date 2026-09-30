import React, { useMemo } from 'react';

interface UpiQrCodeSvgProps {
  upiId: string;
  name?: string;
  className?: string;
}

export const UpiQrCodeSvg: React.FC<UpiQrCodeSvgProps> = ({ upiId, name, className = 'w-full h-full' }) => {
  const modules = useMemo(() => {
    const size = 21;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(14, 0);
    drawFinder(0, 14);

    for (let i = 8; i < 13; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    let hash = 0;
    const str = `${upiId}:${name || ''}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= 13;
        const inBottomLeft = r >= 13 && c < 8;
        const isTiming = r === 6 || c === 6;
        if (!inTopLeft && !inTopRight && !inBottomLeft && !isTiming) {
          const pseudoBit = Math.abs((hash ^ (r * 31 + c * 17 + (hash >> (r % 7)))) % 3);
          grid[r][c] = pseudoBit === 0 || pseudoBit === 2;
        }
      }
    }

    return grid;
  }, [upiId, name]);

  return (
    <svg
      viewBox="0 0 25 25"
      className={className}
      shapeRendering="crispEdges"
      aria-label={`UPI QR code for ${upiId}`}
    >
      <rect x="0" y="0" width="25" height="25" fill="#FFFFFF" rx="2" />
      <g transform="translate(2, 2)">
        {modules.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#111110" />
            ) : null
          )
        )}
      </g>
    </svg>
  );
};
