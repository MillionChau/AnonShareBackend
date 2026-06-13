import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class AdminVerifyTotpDto {
  @IsString()
  @IsNotEmpty()
  loginToken: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  totpCode: string;
}

export class AdminSeedDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  displayName?: string;

  @IsString()
  @IsOptional()
  totpSecret?: string;
}

export class AdminLoginResponseDto {
  loginToken: string;
  requires2FA: true;
  delivery: 'email';
  emailMasked: string;
}

export class AdminSessionResponseDto {
  token: string;
  admin: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    roles: string[];
  };
}

export class AdminSeedResponseDto {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  totpSecret: string;
  message: string;
}
