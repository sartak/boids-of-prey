export const Distance = (dx, dy) => {
  return Math.sqrt(dx ** 2 + dy ** 2);
};

export const NormalizeVector = (dx, dy) => {
  const d = Distance(dx, dy);
  return [dx / d, dy / d];
};

export const NormalizeVectorWithDistance = (dx, dy) => {
  const d = Distance(dx, dy);
  return [dx / d, dy / d, d];
};

export const SumVectors = (vs) => {
  let tx = 0;
  let ty = 0;

  vs.foreach((vx, vy) => {
    tx += vx;
    ty += vy;
  });

  return [tx, ty];
};

export const CentroidPoints = (ps) => {
  let tx = 0;
  let ty = 0;

  ps.foreach((px, py) => {
    tx += px;
    ty += py;
  });

  return [tx / ps.length, ty / ps.length];
};

export const CentroidObjects = (os, x, y) => {
  let tx = 0;
  let ty = 0;

  os.foreach((ox, oy) => {
    tx += ox - x;
    ty += oy - y;
  });

  return [tx / os.length, ty / os.length];
};

export const TowardCentroid = (os, x, y) => {
  let tx = 0;
  let ty = 0;
  os.forEach((o) => {
    tx += o.x - x;
    ty += o.y - y;
  });
  tx /= os.length;
  ty /= os.length;
  return NormalizeVector(tx, ty);
};

export const AvoidObjects = (os, x, y, r) => {
  let tx = 0;
  let ty = 0;
  let count = 0;

  os.forEach((o) => {
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Distance(dx, dy);

    if (d > r) {
      return;
    }

    tx += dx / (d ** 2);
    ty += dy / (d ** 2);
    count += 1;
  });

  if (count === 0) {
    return null;
  }

  tx /= count;
  ty /= count;

  return NormalizeVector(tx, ty);
};

export const AvoidObject = (o, x, y, r) => {
  const [dx, dy, d] = NormalizeVectorWithDistance(x - o.x, y - o.y);

  if (d > r) {
    return;
  }

  return [dx, dy];
};

export const AvoidClosestObject = (os, x, y) => {
  let min;

  os.forEach((o) => {
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Distance(dx, dy);

    if (!min || d < min[0]) {
      min = [d, dx, dy];
    }
  });
  const [d, tx, ty] = min;
  return [tx / d, ty / d];
};

export const ClosestObject = (os, x, y) => {
  let min;

  os.forEach((o) => {
    const dx = o.x - x;
    const dy = o.y - y;
    const d = Distance(dx, dy);

    if (!min || d < min[1]) {
      min = [o, d];
    }
  });
  return min;
};

export const SeekClosestObject = (os, x, y) => {
  let min;

  os.forEach((o) => {
    const dx = o.x - x;
    const dy = o.y - y;
    const d = Distance(dx, dy);

    if (!min || d < min[0]) {
      min = [d, dx, dy];
    }
  });
  const [d, tx, ty] = min;
  return [tx / d, ty / d];
};
