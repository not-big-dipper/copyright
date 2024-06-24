import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import styles from './Player.module.scss';
import classNames from 'classnames';
import Pause from '../../assets/Pause.svg?react';
import Play from '../../assets/Play.svg?react';
import Triangle from '../../assets/Triangle.svg?react';
import Close from '../../assets/Close.svg?react';
import { Tooltip } from 'react-tooltip';
import { ArrowLeft } from '../../components/ArrowLeft';
import { ArrowRight } from '../../components/ArrowRight';
import { Loader } from '../../components/Loader';
import { formatTime } from '../../functions/formatTime';
import { useNavigate } from 'react-router';
import { RootPaths } from '../../pages';
import { createSearchParams } from 'react-router-dom';

interface VideoPlayerProps {
  url: string;
  className?: string;
  previewOnly?: boolean;
  poster?: string;
  onVideoLoaded?: (data: Record<string, string | number>) => void;
  intervals?: Interval[];
}

export type Interval = {
  start: number;
  duration: number;
  color: string;
  type: 'warning' | 'error';
  id: string;
  originalStart: number;
  originalEnd: number;
  originalId: string;
};

export const Player: React.FC<VideoPlayerProps> = ({
  url,
  className,
  previewOnly = false,
  poster,
  onVideoLoaded,
  intervals,
}) => {
  const [played, setPlayed] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isProgressMoving, setIsProgressMoving] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [playedSeconds, setPlayedSeconds] = useState<number>(0);
  const [selectedInterval, setSelectedInterval] = useState<Interval | undefined>(undefined);
  const selectedIntervalIndex =
    intervals?.findIndex((interval) => interval.id === selectedInterval?.id) || 0;

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setPlayed(state.played);
    setPlayedSeconds(state.playedSeconds);
  };

  const sliderRef = useRef(null);

  const moveProgress = useCallback(
    (event: MouseEvent): void => {
      if (sliderRef.current && progressRef.current) {
        // @ts-expect-error this exists
        const rect = sliderRef.current.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const newPlayed = parseFloat(
          Math.min(100, Math.max(0, (offsetX / rect.width) * 100)).toFixed(4),
        );
        progressRef.current.style.width = `${newPlayed}%`;
        setPlayedSeconds(duration * (newPlayed / 100));
      }
    },
    [duration],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      moveProgress(event);
    },
    [moveProgress],
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      setIsProgressMoving(false);
      moveProgress(event);
      if (progressRef.current && playerRef.current) {
        const newPlayed = parseFloat(progressRef?.current?.style.width.slice(0, -1)) / 100;
        setPlayed(newPlayed);
        playerRef.current.seekTo(newPlayed);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, moveProgress],
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // @ts-expect-error className exists
      if (!event.target.className.includes('notification') && !!event.target.className) {
        setIsProgressMoving(true);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    },
    [handleMouseMove, handleMouseUp],
  );

  const handlePlay = useCallback(() => {
    if (!previewOnly) {
      // @ts-expect-error this is videoElement
      const player: HTMLVideoElement = playerRef.current?.getInternalPlayer();
      if (player) {
        if (!player.ended) {
          if (player.paused) {
            player.play();
          } else {
            player.pause();
          }
          setIsPlaying(!isPlaying);
        } else {
          player.currentTime = 0;
          player.play();
          setIsPlaying(true);
        }
      }
    }
  }, [isPlaying, previewOnly]);

  const updateProgress = useCallback(() => {
    if (!progressRef.current) return;
    const playedPercentage = played * 100;
    progressRef.current.style.width = `${playedPercentage}%`;
  }, [played]);

  useEffect(() => {
    if (
      progressRef?.current &&
      played !== parseFloat(progressRef?.current?.style.width.slice(0, -1)) / 100 &&
      !isProgressMoving
    ) {
      requestAnimationFrame(updateProgress);
    }
  }, [isProgressMoving, played, updateProgress]);

  const updateHoverCircleColor = useCallback(() => {
    if (sliderRef.current && progressRef.current) {
      const hoverCircle: HTMLElement | null = document.querySelector(`.${styles.hoverCircle}`);
      if (hoverCircle) {
        let setted = false;
        intervals?.forEach((interval) => {
          if (
            interval.start <= playedSeconds &&
            interval.duration + interval.start >= playedSeconds
          ) {
            setted = true;
            hoverCircle.style.backgroundColor = interval.color;
          }
        });

        if (!setted) {
          hoverCircle.style.backgroundColor = '#e6e4e4'; // Default color
        }
      }
    }
  }, [playedSeconds]);

  useEffect(() => {
    updateHoverCircleColor();

    // @ts-expect-error this is videoElement
    const player: HTMLVideoElement = playerRef.current?.getInternalPlayer();
    if (player?.ended) {
      setIsPlaying(false);
    }
  }, [playedSeconds, updateHoverCircleColor]);

  const durationString = formatTime(duration);
  const playedString = formatTime(Math.trunc(playedSeconds));

  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isKeyPressed) {
        handlePlay();
        setIsKeyPressed(true);
        event.preventDefault(); // предотвращает прокрутку страницы при нажатии пробела
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsKeyPressed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePlay, isKeyPressed]);

  const [loading, setLoading] = useState<boolean>(false);

  const onReady = (): void => {
    setLoading(false);
    // @ts-expect-error fine
    const player: HTMLVideoElement = playerRef.current?.getInternalPlayer();
    if (player) {
      onVideoLoaded?.({
        length: player.duration,
      });
    }
  };

  return (
    <div className={classNames(className, styles.playerWrapper)} onClick={handlePlay}>
      <ReactPlayer
        ref={playerRef}
        url={url}
        controls={false}
        width="100%"
        height="100%"
        onProgress={handleProgress}
        progressInterval={10}
        onDuration={(e) => setDuration(e)}
        style={{ display: 'flex', alignItems: 'center' }}
        onBuffer={() => setLoading(true)}
        onBufferEnd={() => setLoading(false)}
        onReady={onReady}
        config={{
          file: {
            attributes: {
              poster: poster,
            },
          },
        }}
      />
      {!previewOnly && (
        <div className={styles.customControls} onClick={(e) => e.stopPropagation()}>
          <div className={styles.playBtn} onClick={handlePlay}>
            {isPlaying ? <Pause className={styles.pause} /> : <Play className={styles.play} />}
          </div>
          <div
            className={classNames(
              styles.progressBarWrap,
              isProgressMoving && styles.progressBarWrapHovered,
            )}
            ref={sliderRef}
            onMouseDown={handleMouseDown}
          >
            <div className={styles.progressBar}>
              <div
                ref={progressRef}
                className={classNames(styles.progress, styles.progressRounded)}
              >
                <div className={styles.hoverCircle} />
              </div>
              {intervals?.map((interval) => (
                <div key={interval.id}>
                  <div
                    className={classNames(
                      styles.progress,
                      styles.progressColor,
                      interval.id === selectedInterval?.id && styles.selectedInterval,
                    )}
                    style={{
                      width: `${(interval.duration / duration) * 100}%`,
                      backgroundColor: interval.color,
                      marginLeft: `${(interval.start / duration) * 100}%`,
                    }}
                    id={`interval-${interval.id}`}
                  />
                  <Tooltip
                    anchorSelect={`#interval-${interval.id}`}
                    clickable
                    className={styles.tooltip}
                    delayHide={400}
                  >
                    <div onClick={() => setSelectedInterval(interval)}>
                      <div
                        className={classNames(styles.notificationText, styles.notificationTitle)}
                      >
                        {interval?.type === 'error' ? 'Совпадение' : 'Возможное совпадение'}
                      </div>
                      <div
                        className={classNames(styles.notificationText, styles.notificationSubtitle)}
                      >
                        Длительность: {interval?.duration} сек
                      </div>
                      <a className={classNames(styles.notificationText, styles.notificationLink)}>
                        Подробнее
                      </a>
                    </div>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.time}>
            {playedString} / {durationString}
          </div>
        </div>
      )}

      {loading && (
        <div className={styles.loaderWrap}>
          <Loader />
        </div>
      )}

      {selectedInterval && (
        <InfoBlock
          currentInterval={selectedInterval}
          prevAvailable={selectedIntervalIndex > 0}
          nextAvailable={selectedIntervalIndex < (intervals?.length || 0) - 1}
          onNextSelected={() => setSelectedInterval(intervals?.[selectedIntervalIndex + 1])}
          onPrevSelected={() => setSelectedInterval(intervals?.[selectedIntervalIndex - 1])}
          onClose={() => setSelectedInterval(undefined)}
        />
      )}
    </div>
  );
};

const InfoBlock = ({
  currentInterval,
  nextAvailable,
  prevAvailable,
  onPrevSelected,
  onNextSelected,
  onClose,
}: {
  currentInterval: Interval;
  nextAvailable: boolean;
  prevAvailable: boolean;
  onPrevSelected: () => void;
  onNextSelected: () => void;
  onClose: () => void;
}): JSX.Element => {
  const navigate = useNavigate();
  const openPreview = (): void => {
    navigate({
      pathname: RootPaths.preview,
      search: createSearchParams({
        video: currentInterval.originalId,
      }).toString(),
    });
  };
  return (
    <div className={styles.info} onClick={(e) => e.stopPropagation()}>
      <div className={styles.infoContent}>
        <Triangle
          className={classNames(
            styles.infoTriangle,
            currentInterval?.type === 'warning'
              ? styles.infoTriangleWarning
              : styles.infoTriangleError,
          )}
        />
        <div className={styles.infoCloseWrap} onClick={onClose}>
          <Close className={styles.infoClose} />
        </div>
        <div className={styles.infoTitle}>
          {currentInterval.type === 'error' ? 'Совпадение' : 'Возможное совпадение'}
        </div>
        <div className={styles.infoItem}>
          Промежуток совпадения:{' '}
          <span className={styles.infoValue}>
            {formatTime(currentInterval.start)} -{' '}
            {formatTime(currentInterval.start + currentInterval.duration)}
          </span>
        </div>
        <div className={styles.infoItem}>
          Длительность совпадения:{' '}
          <span className={styles.infoValue}>{currentInterval.duration} сек</span>
        </div>
        <div className={styles.infoItem}>
          Оригинальное видео:{' '}
          <a className={classNames(styles.infoValue, styles.infoLink)} onClick={openPreview}>
            ссылка
          </a>
        </div>
        <div className={styles.infoItem}>
          Промежуток оригинала:{' '}
          <span className={styles.infoValue}>
            {formatTime(currentInterval.originalStart)} - {formatTime(currentInterval.originalEnd)}
          </span>
        </div>
        <div className={styles.infoArrows}>
          <ArrowLeft disabled={!prevAvailable} onClick={() => onPrevSelected()} />
          <ArrowRight disabled={!nextAvailable} onClick={() => onNextSelected()} />
        </div>
      </div>
    </div>
  );
};

