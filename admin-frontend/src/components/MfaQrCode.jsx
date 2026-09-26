import React, { useMemo } from 'react';
import { createQrMatrix } from '../utils/qrCodeMatrix.js';

export default function MfaQrCode({ value, size = 220 }) {
  const matrix = useMemo(() => createQrMatrix(value), [value]);
  const count = matrix.length;
  const quietZone = 4;
  const viewSize = count + quietZone * 2;

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      role="img"
      aria-label="Authenticator setup QR code"
      shapeRendering="crispEdges"
      className="max-w-full"
    >
      <rect x="0" y="0" width={viewSize} height={viewSize} fill="white" />
      {matrix.flatMap((row, rowIndex) =>
        row.map((isDark, colIndex) =>
          isDark ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex + quietZone}
              y={rowIndex + quietZone}
              width="1"
              height="1"
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  );
}
