import pandas as pd

VIOLATION_IMAGE_SIMILARITY_THRESHOLD = 0.8

def naive_clusters(labels, max_width=100) -> list[tuple]:
    """
    Naively iterates over the 1D array yielding groups
    of elements where gap between each element is less than max_width
    """
    clusters = []
    current_cluster = []
    for i, label in enumerate(labels):
        if len(current_cluster) == 0:
            current_cluster.append(label)
        elif label - current_cluster[-1] <= max_width:
            current_cluster.append(label)
        else:
            clusters.append(current_cluster)
            current_cluster = [label]
    clusters.append(current_cluster)
    
    spans = [(cluster[0], cluster[-1]) for cluster in clusters]
    return spans


def has_violations(df: pd.DataFrame) -> bool:
    """Checks on any violations"""
    return (df.score > VIOLATION_IMAGE_SIMILARITY_THRESHOLD).any()

def get_violations(df: pd.DataFrame) -> pd.DataFrame:
    """"""
    df = df[df.score > VIOLATION_IMAGE_SIMILARITY_THRESHOLD]
    f_ = df.frame.unique()
    f_.sort()
    frame_lag = f_[1] - f_[0]
    print(f_)
    return naive_clusters(f_, frame_lag * 10)
