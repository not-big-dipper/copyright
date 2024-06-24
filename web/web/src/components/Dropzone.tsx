import { useDropzone } from 'react-dropzone';
import styles from './Dropzone.module.scss';

export const Dropzone = ({
  onVideoUploaded,
}: {
  onVideoUploaded: (video: File, preview: string) => void;
}): JSX.Element => {
  const handleVideoChange = (files: File[]) => {
    if (!files) {
      return;
    }
    files.map((file) => {
      const url = URL.createObjectURL(file);
      onVideoUploaded(file, url);
    });
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'video/*': [],
    },
    onDrop: handleVideoChange,
  });

  return (
    <section>
      <div {...getRootProps({ className: 'dropzone' })}>
        <input {...getInputProps()} />
        <div className={styles.upload}>
          <div className={styles.dashedBorder}>
            <div className={styles.uploadBtn}>Выбрать файлы</div>
            <div className={styles.uploadText}>
              Выберите файлы
              <br /> или перетащите их сюда
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

