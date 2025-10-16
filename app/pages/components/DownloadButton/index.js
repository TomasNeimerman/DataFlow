import styles from "./styles.module.css"

const DownloadIcon = () => {
  return (
    <div className={styles.downloadIcon}>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.icon}>
        <path
          d="M12 3V16M12 16L7 11M12 16L17 11"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4 19H20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default DownloadIcon
