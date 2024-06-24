import dayjs from 'dayjs';
import styles from './ReportPage.module.scss';
import cardsStyles from './VideoReport.module.scss';
import { InfoItem } from './VideoReport';
import classNames from 'classnames';
import { formatTimeHHMM } from '../functions/formatTimeHHMM';

export const ReportPage = ({
  name,
  author,
  probes,
  plagiatPart,
  currentPreview,
}: {
  name: string;
  author: string;
  probes: Array<Record<string, string | number>>;
  plagiatPart: string;
  currentPreview: string;
}): JSX.Element => {
  const today = dayjs().format('DD.MM.YYYY');
  const probesLength = probes?.reduce(
    (total, probe) => total + ((probe.end as number) - (probe.start as number)),
    0,
  );
  let maxDuration = 0;

  probes?.forEach((probe) => {
    const duration = (probe.end as number) - (probe.start as number);
    if (duration > maxDuration) {
      maxDuration = duration;
    }
  });
  const uniqueVideoIds = new Set();

  probes?.forEach((probe) => {
    uniqueVideoIds.add(probe.video_id);
  });

  const uniqueVideoIdsCount = uniqueVideoIds.size;
  const probesWithoutFirst = probes.slice(1);
  return (
    <div className={styles.a4} id="report">
      <div className={styles.page}>
        <div className={styles.title}>Отчет о проверке от {today}</div>
        <div className={styles.videoName}>Видео: “{name}”</div>
        <div className={styles.videoAuthor}>Автор видео: {author}</div>
        <div className={styles.blockTitle}>Общая информация</div>
        <div className={styles.line}>
          <InfoItem>
            <div className={cardsStyles.simpleCard}>
              <div className={cardsStyles.cardName}>
                Найдено
                <br />
                совпадений
              </div>
              <div className={cardsStyles.cardValue}>{probes.length}</div>
            </div>
          </InfoItem>
          <InfoItem>
            <div className={cardsStyles.simpleCard}>
              <div className={cardsStyles.cardName}>
                Длительность
                <br />
                совпадений
              </div>
              <div className={cardsStyles.cardValue}>
                {probesLength} <span className={cardsStyles.cardValueNote}>сек</span>
              </div>
            </div>
          </InfoItem>
          <InfoItem>
            <div className={cardsStyles.simpleCard}>
              <div className={cardsStyles.cardName}>
                Максимальное
                <br />
                совпадение
              </div>
              <div className={cardsStyles.cardValue}>
                <span className={cardsStyles.underline}>{maxDuration}</span>{' '}
                <span className={cardsStyles.cardValueNote}>сек</span>
              </div>
            </div>
          </InfoItem>
        </div>
        <div className={styles.line}>
          <InfoItem className={styles.notGrow}>
            <div className={styles.secondLineCard}>
              <div className={classNames(cardsStyles.cardFirstLine, styles.gap12)}>
                <div className={cardsStyles.cardName}>Заимствование</div>
                <div className={cardsStyles.cardValue}>
                  {plagiatPart}
                  <span className={cardsStyles.cardValueNote}>%</span>
                </div>
              </div>
            </div>
          </InfoItem>
        </div>
        <div className={classNames(styles.line, styles.lastLine)}>
          <InfoItem className={styles.notGrow}>
            <div className={styles.uniqueCard}>
              <div className={cardsStyles.simpleCard}>
                <div className={cardsStyles.cardName}>
                  Уникальных
                  <br />
                  заимствующих видео
                </div>
                <div className={cardsStyles.cardValue}>{uniqueVideoIdsCount}</div>
              </div>
              <div className={styles.videosList}>
                {Object.values(uniqueVideoIds)?.map((elem) => (
                  <div className={styles.videoItem}>{elem}</div>
                ))}
              </div>
            </div>
          </InfoItem>
        </div>
        {probes.length ? (
          <>
            <div className={styles.blockTitle}>Нарушения</div>
            <div className={styles.comparisonTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Текущее видео</th>
                    <th>Оригинальное видео</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className={styles.flexTd}>
                        Время
                        <br />
                        совпадения, сек
                        <div className={cardsStyles.cardValue}>
                          {(probes[0].end as number) - (probes[0].start as number)}
                        </div>
                      </div>
                    </td>

                    <td rowSpan={2}>
                      <img
                        src={currentPreview}
                        alt="Current Video Image"
                        className={styles.tableImage}
                      />
                    </td>
                    <td rowSpan={2}>
                      <img
                        src={currentPreview}
                        alt="Current Video Image"
                        className={styles.tableImage}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className={styles.flexTd}>
                        Заимствование
                        <br />
                        промежутка, %
                        <div className={cardsStyles.cardValue}>
                          {' '}
                          {((probes?.[0]?.avg_score as number) * 100).toFixed(2)}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className={styles.flexTd}>
                        Тайминг совпадения
                        <div />
                      </div>
                    </td>
                    <td>
                      <div className={styles.timingWrap}>
                        <div className={styles.timing}>
                          <div className={styles.timingName}>Начало</div>
                          <div className={classNames(cardsStyles.cardValue, styles.smallValue)}>
                            <span className={cardsStyles.underline}>
                              {formatTimeHHMM(probes[0].start as number)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.timing}>
                          <div className={styles.timingName}>Конец</div>
                          <div className={classNames(cardsStyles.cardValue, styles.smallValue)}>
                            <span className={cardsStyles.underline}>
                              {formatTimeHHMM(probes[0].end as number)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
      {probesWithoutFirst.length
        ? probesWithoutFirst.map((probe) => (
            <div className={styles.page}>
              <div className={styles.comparisonTable}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Текущее видео</th>
                      <th>Оригинальное видео</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className={styles.flexTd}>
                          Время
                          <br />
                          совпадения, сек
                          <div className={cardsStyles.cardValue}>
                            {(probe.end as number) - (probe.start as number)}
                          </div>
                        </div>
                      </td>

                      <td rowSpan={2}>
                        <img
                          src={currentPreview}
                          alt="Current Video Image"
                          className={styles.tableImage}
                        />
                      </td>
                      <td rowSpan={2}>
                        <img
                          src={currentPreview}
                          alt="Current Video Image"
                          className={styles.tableImage}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className={styles.flexTd}>
                          Заимствование
                          <br />
                          промежутка, %
                          <div className={cardsStyles.cardValue}>
                            {((probe?.avg_score as number) * 100).toFixed(2)}
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className={styles.flexTd}>
                          Тайминг совпадения
                          <div />
                        </div>
                      </td>
                      <td>
                        <div className={styles.timingWrap}>
                          <div className={styles.timing}>
                            <div className={styles.timingName}>Начало</div>
                            <div className={classNames(cardsStyles.cardValue, styles.smallValue)}>
                              <span className={cardsStyles.underline}>
                                {formatTimeHHMM(probe.start as number)}
                              </span>
                            </div>
                          </div>
                          <div className={styles.timing}>
                            <div className={styles.timingName}>Конец</div>
                            <div className={classNames(cardsStyles.cardValue, styles.smallValue)}>
                              <span className={cardsStyles.underline}>
                                {formatTimeHHMM(probe.end as number)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))
        : null}
    </div>
  );
};

