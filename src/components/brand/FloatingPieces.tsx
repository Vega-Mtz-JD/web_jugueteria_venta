import styles from "./FloatingPieces.module.css";

export function FloatingPieces() {
  return (
    <div aria-hidden className={styles.wrap}>
      <span className={`${styles.piece} ${styles.knight}`}>♞</span>
      <span className={`${styles.piece} ${styles.queen}`}>♛</span>
      <span className={`${styles.piece} ${styles.die}`}>🎲</span>
    </div>
  );
}
