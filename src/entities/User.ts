import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  FINANCE = 'finance',
  SUPPORT = 'support',
  TECHNICAL = 'technical',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.SUPPORT })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ default: false, name: 'two_factor_enabled' })
  twoFactorEnabled!: boolean;

  @Column({ nullable: true, name: 'two_factor_secret' })
  twoFactorSecret!: string;

  @Column({ nullable: true, name: 'last_login' })
  lastLogin!: Date;

  @Column({ default: true })
  isSystem!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
