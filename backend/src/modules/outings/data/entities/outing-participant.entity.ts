import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IOutingParticipant } from '../../domain/interfaces/outing-participant.interface';
import { OutingEntity } from './outing.entity';
import { MemberEntity } from '../../../expenses/data/entities/member.entity';

@Entity('outing_participants')
@Index('idx_outing_participants_unique', ['outingId', 'slug'], { unique: true })
@Index('idx_outing_participants_outing', ['outingId'])
export class OutingParticipantEntity implements IOutingParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'outing_id', type: 'uuid' })
  outingId: string;

  @ManyToOne(() => OutingEntity, (outing) => outing.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'outing_id' })
  outing: OutingEntity;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ name: 'member_id', type: 'uuid', nullable: true })
  memberId?: string;

  @ManyToOne(() => MemberEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'member_id' })
  member?: MemberEntity;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  aliases: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
