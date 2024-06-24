from .engine import get_session
from ....schema.audio import FingerprintData, RecordData

def db_write(function):
    def wrapper(*args, **kwargs):
        session = get_session()
        try:
            result = function(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    return wrapper


def db_read(function):
    def wrapper(*args, **kwargs):
        session = get_session()
        try:
            return function(session, *args, **kwargs)
        finally:
            session.close()
    return wrapper

@db_write
def new_fingerprint(session, record_id, hash, offset):
    from .models import Fingerprint
    fingerprint = Fingerprint(record_id=record_id, hash=hash, offset=offset)
    session.add(fingerprint)
    return fingerprint

@db_write
def new_fingerprints(session, data: list[FingerprintData]):
    from .models import Fingerprint
    objs = [Fingerprint(**elem.model_dump()) for elem in data]
    session.bulk_save_objects(objs)
    session.commit()
    return objs


@db_read
def get_fingerprints(session, record_id = None, hash = None):
    from .models import Fingerprint
    expr_1 = True
    if record_id:
        expr_1 = Fingerprint.record_id == record_id
    expr_2 = True
    if hash:
        expr_2 = Fingerprint.hash == hash
    return session.query(Fingerprint).filter(expr_1, expr_2).all()

@db_read
def get_fingerprints_in(
    session, 
    record_ids: list[str] | None = None, 
    hashes: list[str] | None = None
):
    from .models import Fingerprint
    expr_1 = True
    if record_ids:
        expr_1 = Fingerprint.record_id.in_(record_ids)
    expr_2 = True
    if hashes:
        expr_2 = Fingerprint.hash.in_(hashes)
    return session.query(Fingerprint).filter(expr_1, expr_2).all()


@db_write
def delete_fingerprints(session, record_id):
    from .models import Fingerprint
    session.query(Fingerprint).filter(Fingerprint.record_id == record_id).delete()
    
@db_write
def new_record(session, record_id):
    from .models import Record
    record = Record(record_id=record_id)
    session.add(record)
    return record

@db_write
def new_records(session, data: list[RecordData]):
    from .models import Record
    objs = [Record(record_id=elem.record_id) for elem in data]
    session.bulk_save_objects(objs)
    session.commit()
    return objs

@db_read
def get_record(session, record_id):
    from .models import Record
    return session.query(Record).filter(Record.record_id == record_id).first()

@db_read
def get_records(session):
    from .models import Record
    return session.query(Record).all()

@db_write
def delete_record(session, record_id):
    from .models import Record
    session.query(Record).filter(Record.record_id == record_id).delete()
    
@db_write
def delete_all_records(session):
    from .models import Record
    session.query(Record).delete()
    
@db_write
def delete_all_fingerprints(session):
    from .models import Fingerprint
    session.query(Fingerprint).delete()
    
    