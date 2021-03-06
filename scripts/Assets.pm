package Assets;
use strict;
use warnings;
use Exporter 'import';

our @EXPORT = qw/parse_assets emit_assets assert_asset_type canonicalize_asset_type emit_and_diff_assets intuit_type_for_filename is_candidate_for_type/;

my @types = (
  'imageAssets',
  'spriteAssets',
  'musicAssets',
  'soundAssets',
);

sub intuit_type_for_filename {
  local $_ = shift;
  my $silent = shift;

  return 'musicAssets' if /\.mp3$/;
  return 'soundAssets' if /\.wav$/;

  if (/\.(png|jpg)$/) {
    return 'spriteAssets' if /sprite/i;
    return 'imageAssets';
  }

  return '' if $silent;

  die "unable to intuit type for $_";
}

sub is_candidate_for_type {
  local $_ = shift;
  my $type = shift;

  return $type eq 'musicAssets' if /\.mp3$/;
  return $type eq 'soundAssets' if /\.wav$/;

  if (/\.(png|jpg)$/) {
    return $type eq 'spriteAssets' || $type eq 'imageAssets';
  }

  return;
}

sub parse_assets {
  my $assets_file = shift;

  my %assets;

  open my $handle, '<', $assets_file or die $!;

  my $is_imports = 1;
  my $current_type;
  my $current_lines;

  while (<$handle>) {
    chomp;

    if ($current_lines) {
      if (/^\s*},$/) {
        $current_lines = undef;
        next;
      }
      else {
        push @$current_lines, $_;
        next;
      }
    }

    next if /^\s*$/;

    next if m{^// This file is automatically generated by asset scripts in scripts/$};

    if (/^import (\w+) from '([^']+)';$/) {
      if (!$is_imports) {
        die "Unexpected import line $_; they need to come first";
      }

      my ($name, $path) = ($1, $2);
      $assets{$name} = { path => $path };
      next;
    }

    $is_imports = 0;

    if (/^export const (\w+) = \{$/) {
      my ($type) = $1;
      assert_asset_type($type);
      $current_type = $type;
      next;
    }

    if (/^\s+(\w+),$/) {
      my ($entry) = $1;
      die "Unexpected entry $entry, since we're not in an export const { ... }" if !$current_type;
      die "Unexpected entry $entry, since it was not imported" if !$assets{$entry};
      $assets{$entry}{type} = $current_type;
      next;
    }

    if (/^\s+(\w+): \{$/) {
      my ($entry) = $1;
      die "Unexpected entry $entry, since we're not in an export const { ... }" if !$current_type;
      $assets{$entry}{type} = $current_type;
      $assets{$entry}{extra} = $current_lines = [];
      next;
    }

    if (/^};$/) {
      die "Unexpected };, since we're not in an export const { ... }" if !$current_type;
      $current_type = undef;
      next;
    }

    die "Unexpected line in $assets_file: $_";
  }

  return \%assets;
}

sub emit_assets {
  my $handle = shift;
  my $assets = shift;

  print $handle "// This file is automatically generated by asset scripts in scripts/\n";
  print $handle "\n";

  for my $name (sort keys %$assets) {
    my %props = %{ $assets->{$name} };
    my $path = $props{path};

    print $handle "import $name from '$path';\n";
  }

  print $handle "\n";

  for my $type (@types) {
    print $handle "\n" if $type ne $types[0];

    print $handle "export const $type = {\n";
    for my $name (sort grep { $assets->{$_}{type} eq $type } keys %$assets) {
      if ($assets->{$name}{extra}) {
        print $handle "  $name: {\n";
        print $handle "$_\n" for @{ $assets->{$name}{extra} };
        print $handle "  },\n";
      }
      else {
        print $handle "  $name,\n";
      }
    }
    print $handle "};\n";
  }
}

sub canonicalize_asset_type {
  my $type = shift;
  return $type if grep { $_ eq $type } @types;

  my $try = lc($type) . "Assets";
  return $try if grep { $_ eq $try } @types;

  die "Unexpected type $type, expected one of @types";
}

sub assert_asset_type {
  my $type = shift;

  die "Unexpected type $type, expected one of @types" unless grep { $_ eq $type } @types;
}

sub emit_and_diff_assets {
  my $assets_file = shift;
  my $assets = shift;

  my $tmp_file = "/tmp/" . time . "-assets.js";
  open my $handle, '>', $tmp_file or die $!;
  emit_assets($handle, $assets);
  system("cp", $tmp_file, $assets_file);
  system("git", "diff", $assets_file);
}

1;

