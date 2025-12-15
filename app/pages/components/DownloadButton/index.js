import styles from "./styles.module.css"
import download from '../../../public/icons/download.png'
import Image from 'next/image';

const DownloadIcon = () => {
  return (
    <div className={styles.downloadIcon}>
      <Image src={download} alt="Download Button" />
    </div>
  )
}

export default DownloadIcon
