from sqlalchemy import Column, String, Integer, UniqueConstraint, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Record(Base):
    __tablename__ = 'records'
    
    record_id = Column(String(255), primary_key=True, unique=True, nullable=False)
    # Define relationship to Fingerprint
    fingerprints = relationship('Fingerprint', back_populates='record')

class Fingerprint(Base):
    __tablename__ = 'fingerprints'
    
    hash = Column(String(40), nullable=False, index=True)
    record_id = Column(String(255), ForeignKey('records.record_id'), nullable=False)
    offset = Column(Integer, nullable=False)

    # Define relationship back to Record
    record = relationship('Record', back_populates='fingerprints')

    __table_args__ = (
        UniqueConstraint('hash', 'record_id', 'offset', name='uq_hash_record_id_offset'),
        PrimaryKeyConstraint('hash', 'record_id', 'offset'),
    )
